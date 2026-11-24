import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  StatusBar,
  Linking,
  Platform,
  Share,
  Clipboard,
  Image,
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

const GREEN = '#187A33';
const BLUE = '#0070C0';
const LIGHT_BLUE = '#E8F3FD';
const API_URL = 'https://vagdanam.com/Vighna/gstapi/sales_api.php';
const WEB_BASE = 'https://vagdanam.com/Vighna/gstapi';

export default function InvoiceViewScreen({ navigation, route }) {
  const invoiceId = route?.params?.invoiceId || route?.params?.invoice?.id || 0;
  const invoiceObj = route?.params?.invoice || null;

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const [seller, setSeller] = useState(null);
  const [customer, setCustomer] = useState(null);

  const [copies, setCopies] = useState({
    original: true,
    duplicate: false,
    transport: false,
    office: false,
  });

  const [sessionUser, setSessionUser] = useState(
    route?.params?.userData || route?.params?.user || null
  );

  /* ---------------- Session ---------------- */
  useEffect(() => {
    (async () => {
      try {
        let user = route?.params?.userData || route?.params?.user || null;
        if (!user) {
          const stored = await SecureStore.getItemAsync('user_session');
          if (stored) user = JSON.parse(stored);
        }
        setSessionUser(user);
      } catch (e) {
        console.error('Session load failed:', e);
      }
    })();
  }, []);

  const currentUserId = sessionUser?.id ?? sessionUser?.user_id ?? null;

  /* ---------------- Fetch invoice ---------------- */
  const fetchInvoice = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    try {
      const url =
        API_URL +
        '?action=get_invoice&id=' +
        encodeURIComponent(invoiceId) +
        '&user_id=' +
        encodeURIComponent(currentUserId || '');
      const res = await fetch(url);
      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }

      if (data && data.status === 'success' && data.data) {
        setInvoice(data.data.invoice || null);
        setItems(Array.isArray(data.data.items) ? data.data.items : []);
        setSeller(data.data.seller || null);
        setCustomer(data.data.customer || null);
      } else {
        // Fallback: use the item passed from SalesScreen
        if (invoiceObj) {
          setInvoice(invoiceObj);
        } else {
          Alert.alert('Error', (data && data.message) || 'Invoice not found');
        }
      }
    } catch (e) {
      console.error('fetchInvoice:', e);
      if (invoiceObj) setInvoice(invoiceObj);
    } finally {
      setLoading(false);
    }
  }, [invoiceId, currentUserId, invoiceObj]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  /* ---------------- Helpers ---------------- */
  const n = (v) => Number(v || 0);
  const fmt = (v, d = 2) =>
    n(v).toLocaleString('en-IN', {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });

  const formatDate = (s) => {
    if (!s) return '-';
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatExpiry = (s) => {
    if (!s) return '';
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${mm}-${d.getFullYear()}`;
  };

  const numberToWords = (num) => {
    num = Math.floor(Number(num) || 0);
    const ones = ['ZERO','ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE',
      'TEN','ELEVEN','TWELVE','THIRTEEN','FOURTEEN','FIFTEEN','SIXTEEN','SEVENTEEN',
      'EIGHTEEN','NINETEEN'];
    const tens = ['', '', 'TWENTY','THIRTY','FORTY','FIFTY','SIXTY','SEVENTY','EIGHTY','NINETY'];

    const conv = (n) => {
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      if (n < 1000)
        return ones[Math.floor(n / 100)] + ' HUNDRED' + (n % 100 ? ' ' + conv(n % 100) : '');
      if (n < 100000)
        return conv(Math.floor(n / 1000)) + ' THOUSAND' + (n % 1000 ? ' ' + conv(n % 1000) : '');
      if (n < 10000000)
        return conv(Math.floor(n / 100000)) + ' LAKH' + (n % 100000 ? ' ' + conv(n % 100000) : '');
      return conv(Math.floor(n / 10000000)) + ' CRORE' + (n % 10000000 ? ' ' + conv(n % 10000000) : '');
    };

    if (num === 0) return 'ZERO';

    const rupees = Math.floor(num);
    const paise = Math.round((num - rupees) * 100);
    let out = conv(rupees) + ' RUPEES';
    if (paise > 0) out += ' AND ' + conv(paise) + ' PAISE';
    return out + ' ONLY';
  };

  const copyLabel = (key) =>
    ({
      original: 'ORIGINAL FOR RECIPIENT',
      duplicate: 'DUPLICATE COPY',
      transport: 'TRIPLICATE FOR TRANSPORT',
      office: 'QUADRUPLICATE FOR OFFICE',
    }[key] || '');

  /* ---------------- Totals ---------------- */
  const grandTotal = n(invoice?.grand_total);
  const sumQty = items.reduce((s, it) => s + n(it.quantity), 0);
  const sumDisc = items.reduce((s, it) => s + n(it.discount), 0);
  const amountWords = invoice?.grand_total_words || numberToWords(grandTotal);

  /* ---------------- Handlers ---------------- */
  const toggleCopy = (key) => {
    setCopies((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!Object.values(next).some(Boolean)) return prev;
      return next;
    });
  };

  const shareWhatsApp = () => {
    const url = WEB_BASE + '/view_invoice.php?id=' + invoiceId;
    const text = 'Sale Invoice ' + (invoice?.invoice_no || '') + ': ' + url;
    Linking.openURL('https://wa.me/?text=' + encodeURIComponent(text)).catch(() =>
      Alert.alert('Error', 'Could not open WhatsApp')
    );
  };

  const shareEmail = () => {
    const url = WEB_BASE + '/view_invoice.php?id=' + invoiceId;
    Linking.openURL(
      'mailto:?subject=' +
        encodeURIComponent('Sale Invoice ' + (invoice?.invoice_no || '')) +
        '&body=' +
        encodeURIComponent(url)
    ).catch(() => {});
  };

  const shareSMS = () => {
    const url = WEB_BASE + '/view_invoice.php?id=' + invoiceId;
    const sep = Platform.OS === 'ios' ? '&' : '?';
    Linking.openURL(
      'sms:' + sep + 'body=' + encodeURIComponent('Invoice: ' + url)
    ).catch(() => {});
  };

  const downloadInvoice = () => {
    Linking.openURL(
      WEB_BASE + '/view_invoice.php?id=' + invoiceId + '&download=1'
    ).catch(() => Alert.alert('Error', 'Could not download'));
  };

  const printInvoice = () => {
    Linking.openURL(
      WEB_BASE + '/view_invoice.php?id=' + invoiceId + '&print=1'
    ).catch(() => Alert.alert('Error', 'Could not print'));
  };

  const copyLink = () => {
    const url = WEB_BASE + '/view_invoice.php?id=' + invoiceId;
    Clipboard.setString(url);
    Alert.alert('Copied', 'Invoice link copied');
  };

  /* ---------------- Render invoice card ---------------- */
  const renderInvoice = (copyKey) => {
    const selCopies = Object.keys(copies).filter((k) => copies[k]);

    return (
      <View style={styles.invoiceCard} key={copyKey}>
        {/* Seller header */}
        <View style={styles.sellerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.firmName}>
              {seller?.companyname || 'Your Firm'}
            </Text>
            <Text style={styles.sellerAddr}>
              {[seller?.address1, seller?.address2]
                .filter(Boolean)
                .join(', ')}
            </Text>
            <Text style={styles.sellerAddr}>
              {[seller?.city, seller?.state, seller?.pincode]
                .filter(Boolean)
                .join(', ')}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {seller?.full_name ? (
              <Text style={styles.sellerMeta}>
                <Text style={styles.bold}>Name: </Text>
                {seller.full_name}
              </Text>
            ) : null}
            {seller?.contactno1 ? (
              <Text style={styles.sellerMeta}>
                <Text style={styles.bold}>Phone: </Text>
                {seller.contactno1}
              </Text>
            ) : null}
            {seller?.gstno ? (
              <Text style={styles.sellerMeta}>
                <Text style={styles.bold}>GSTIN: </Text>
                {seller.gstno}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Title bar */}
        <View style={styles.titleBar}>
          <View style={{ width: 90 }} />
          <Text style={styles.titleText}>TAX INVOICE</Text>
          <Text style={styles.copyText}>{copyLabel(copyKey)}</Text>
        </View>

        {/* Customer + Invoice meta */}
        <View style={styles.twoCol}>
          <View style={[styles.col, { borderRightWidth: 1 }]}>
            <Text style={styles.sectionLabel}>Customer Detail</Text>
            <Row label="M/S" value={invoice?.customer_name || '-'} />
            <Row
              label="Address"
              value={
                [customer?.address1, customer?.address2, customer?.city, customer?.state]
                  .filter(Boolean)
                  .join(', ') || invoice?.billing_address || '-'
              }
            />
            <Row label="Phone" value={customer?.contactno1 || '-'} />
            {invoice?.customer_gst ? (
              <Row label="GSTIN" value={invoice.customer_gst} />
            ) : null}
            <Row
              label="Place of Supply"
              value={(invoice?.place_of_supply || '-') + ' ( 28 )'}
            />
          </View>
          <View style={styles.col}>
            <Row label="Invoice No" value={invoice?.invoice_no || '-'} />
            <Row label="Invoice Date" value={formatDate(invoice?.invoice_date)} />
            <Row label="Due Date" value={formatDate(invoice?.due_date)} />
          </View>
        </View>

        {/* Items table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { width: '6%' }]}>#</Text>
          <Text style={[styles.th, { width: '30%' }]}>Product</Text>
          <Text style={[styles.th, { width: '12%' }]}>HSN</Text>
          <Text style={[styles.th, { width: '12%' }]}>Batch</Text>
          <Text style={[styles.th, { width: '12%' }]}>Expiry</Text>
          <Text style={[styles.th, { width: '8%', textAlign: 'right' }]}>Qty</Text>
          <Text style={[styles.th, { width: '10%', textAlign: 'right' }]}>Rate</Text>
          <Text style={[styles.th, { width: '10%', textAlign: 'right' }]}>Total</Text>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyText}>No items</Text>
          </View>
        ) : (
          items.map((it, i) => (
            <View
              key={String(it.id || i)}
              style={[
                styles.tr,
                i % 2 === 0 && { backgroundColor: '#fafbfc' },
              ]}
            >
              <Text style={[styles.td, { width: '6%', textAlign: 'center' }]}>
                {i + 1}
              </Text>
              <View style={{ width: '30%' }}>
                <Text style={styles.td} numberOfLines={2}>
                  {it.product_name || '-'}
                </Text>
                {it.product_code ? (
                  <Text style={styles.tdSub}>{it.product_code}</Text>
                ) : null}
              </View>
              <Text style={[styles.td, { width: '12%', textAlign: 'center' }]}>
                {it.hsn_code || '-'}
              </Text>
              <Text style={[styles.td, { width: '12%', textAlign: 'center' }]}>
                {it.batch_no || '-'}
              </Text>
              <Text style={[styles.td, { width: '12%', textAlign: 'center' }]}>
                {formatExpiry(it.expiry_date) || '-'}
              </Text>
              <Text style={[styles.td, { width: '8%', textAlign: 'right' }]}>
                {fmt(it.quantity)}
              </Text>
              <Text style={[styles.td, { width: '10%', textAlign: 'right' }]}>
                {fmt(it.rate)}
              </Text>
              <Text
                style={[
                  styles.td,
                  { width: '10%', textAlign: 'right', fontWeight: '600' },
                ]}
              >
                {fmt(it.line_total)}
              </Text>
            </View>
          ))
        )}

        {/* Totals row */}
        <View style={styles.totalsRow}>
          <Text style={[styles.totalCell, { flex: 1, textAlign: 'right' }]}>Total</Text>
          <Text style={[styles.totalCell, { width: 60, textAlign: 'right' }]}>
            {fmt(sumQty)}
          </Text>
          <Text style={[styles.totalCell, { width: 80, textAlign: 'right' }]}>
            {fmt(sumDisc)}
          </Text>
          <Text
            style={[
              styles.totalCell,
              {
                width: 90,
                textAlign: 'right',
                backgroundColor: LIGHT_BLUE,
                fontWeight: '800',
              },
            ]}
          >
            ₹{fmt(grandTotal)}
          </Text>
        </View>

        {/* Amount in words */}
        <View style={styles.wordsBox}>
          <Text style={styles.sectionLabel}>Total in words</Text>
          <Text style={styles.wordsText}>{amountWords}</Text>
        </View>

        {/* Terms */}
        <View style={styles.termsBox}>
          <Text style={styles.sectionLabel}>Terms & Conditions</Text>
          <Text style={styles.termsText}>
            {'1. Subject to our home Jurisdiction.\n'}
            {'2. Our Responsibility Ceases as soon as goods leaves our Premises.\n'}
            {'3. Goods once sold will not taken back.\n'}
            {'4. Delivery Ex-Premises.'}
          </Text>
        </View>

        {/* Grand total + signatory */}
        <View style={styles.grandRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionLabel}>For {seller?.companyname || ''}</Text>
            <View style={{ height: 40 }} />
            <Text style={styles.signatory}>Authorised Signatory</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.sectionLabel}>Grand Total</Text>
            <Text style={styles.grandTotal}>₹{fmt(grandTotal)}</Text>
            <Text style={styles.eoe}>(E & O.E.)</Text>
          </View>
        </View>

        {/* Number of copies rendered */}
        <Text style={styles.multiHint}>
          Copies selected: {selCopies.length}
        </Text>
      </View>
    );
  };

  /* ---------------- Guard ---------------- */
  if (!invoiceId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Ionicons name="alert-circle" size={48} color="#dc3545" />
          <Text style={styles.errorText}>Invalid invoice ID</Text>
          <TouchableOpacity
            style={styles.errorBtn}
            onPress={() => navigation?.goBack?.()}
          >
            <Text style={styles.errorBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* ====================================================================== */
  /*  UI                                                                    */
  /* ====================================================================== */
  const activeCopies = Object.keys(copies).filter((k) => copies[k]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={GREEN} barStyle="light-content" />
      <View style={styles.container}>

        {/* ================= HEADER ================= */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation?.goBack?.()}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>
            {invoice?.invoice_no || invoiceObj?.invoice_no || 'Invoice'}
          </Text>

          <TouchableOpacity style={styles.headerIconBtn} onPress={copyLink}>
            <Ionicons name="copy-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ================= BODY ================= */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={GREEN} />
            <Text style={styles.loadingText}>Loading invoice…</Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollBody}
            showsVerticalScrollIndicator
          >
            {activeCopies.length === 0
              ? renderInvoice('original')
              : activeCopies.map((k) => renderInvoice(k))}
            <View style={{ height: 20 }} />
          </ScrollView>
        )}

        {/* ================= COPY OPTIONS ================= */}
        <View style={styles.copyBar}>
          {[
            { key: 'original', label: 'Original' },
            { key: 'duplicate', label: 'Duplicate' },
            { key: 'transport', label: 'Transport' },
            { key: 'office', label: 'Office' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={styles.copyOption}
              onPress={() => toggleCopy(opt.key)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.checkbox,
                  copies[opt.key] && styles.checkboxChecked,
                ]}
              >
                {copies[opt.key] && (
                  <Ionicons name="checkmark" size={12} color="#fff" />
                )}
              </View>
              <Text style={styles.copyLabel}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ================= BOTTOM ACTIONS ================= */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#55cf64' }]}
            onPress={shareWhatsApp}
          >
            <FontAwesome5 name="whatsapp" size={16} color="#fff" />
            <Text style={styles.actionText}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#ff744d' }]}
            onPress={shareEmail}
          >
            <FontAwesome5 name="envelope" size={14} color="#fff" />
            <Text style={styles.actionText}>Email</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#25a9dc' }]}
            onPress={shareSMS}
          >
            <FontAwesome5 name="sms" size={15} color="#fff" />
            <Text style={styles.actionText}>SMS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#f5bc22' }]}
            onPress={downloadInvoice}
          >
            <FontAwesome5 name="download" size={14} color="#fff" />
            <Text style={styles.actionText}>Download</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#10b981' }]}
            onPress={printInvoice}
          >
            <FontAwesome5 name="print" size={14} color="#fff" />
            <Text style={styles.actionText}>Print</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#6c757d' }]}
            onPress={() => navigation?.goBack?.()}
          >
            <Ionicons name="close" size={16} color="#fff" />
            <Text style={styles.actionText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

/* ---------------- Sub-components ---------------- */
function Row({ label, value }) {
  return (
    <View style={styles.rowItem}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: GREEN },
  container: { flex: 1, backgroundColor: '#eef0f2' },

  // Header
  header: {
    height: 56,
    backgroundColor: GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingTop: StatusBar.currentHeight || 0,
  },
  headerIconBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginHorizontal: 6,
  },

  // Scroll body
  scrollBody: {
    padding: 10,
  },

  // Invoice card
  invoiceCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BLUE,
  },

  // Seller
  sellerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BLUE,
    paddingBottom: 8,
    marginBottom: 8,
  },
  firmName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  sellerAddr: {
    fontSize: 11,
    color: '#444',
    marginTop: 2,
    lineHeight: 15,
  },
  sellerMeta: {
    fontSize: 11,
    color: '#333',
    marginTop: 2,
  },
  bold: { fontWeight: '700' },

  // Title bar
  titleBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: BLUE,
    marginBottom: 8,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '800',
    color: BLUE,
    letterSpacing: 0.5,
  },
  copyText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#333',
    flexShrink: 1,
    textAlign: 'right',
    maxWidth: 130,
  },

  // Two-col section
  twoCol: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: BLUE,
    marginBottom: 10,
  },
  col: {
    flex: 1,
    borderColor: BLUE,
    padding: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: BLUE,
    backgroundColor: LIGHT_BLUE,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginBottom: 4,
    textAlign: 'center',
    borderRadius: 3,
  },
  rowItem: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  rowLabel: {
    width: 90,
    fontSize: 11,
    fontWeight: '700',
    color: '#333',
  },
  rowValue: {
    flex: 1,
    fontSize: 11,
    color: '#1a1a1a',
  },

  // Items table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: LIGHT_BLUE,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: BLUE,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  th: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  tr: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BLUE,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  td: {
    fontSize: 11,
    color: '#1a1a1a',
  },
  tdSub: {
    fontSize: 9,
    color: '#6c757d',
    marginTop: 1,
  },
  emptyRow: {
    borderWidth: 1,
    borderColor: BLUE,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: '#6c757d',
  },

  // Totals row
  totalsRow: {
    flexDirection: 'row',
    backgroundColor: LIGHT_BLUE,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BLUE,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  totalCell: {
    fontSize: 11,
    color: '#1a1a1a',
  },

  // Amount words
  wordsBox: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BLUE,
    padding: 8,
  },
  wordsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginTop: 2,
  },

  // Terms
  termsBox: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BLUE,
    padding: 8,
  },
  termsText: {
    fontSize: 10,
    color: '#333',
    lineHeight: 15,
    marginTop: 2,
  },

  // Grand total + signature
  grandRow: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BLUE,
    padding: 8,
    alignItems: 'flex-start',
  },
  grandTotal: {
    fontSize: 18,
    fontWeight: '800',
    color: BLUE,
    marginTop: 2,
  },
  eoe: {
    fontSize: 10,
    fontWeight: '700',
    color: '#333',
    marginTop: 2,
  },
  signatory: {
    fontSize: 10,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },
  multiHint: {
    fontSize: 9,
    color: '#adb5bd',
    textAlign: 'center',
    marginTop: 8,
  },

  // Copy options bar
  copyBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#dfe3e6',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  copyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#adb5bd',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#00b894',
    borderColor: '#00b894',
  },
  copyLabel: {
    fontSize: 11,
    color: '#4a4a4a',
    fontWeight: '500',
  },

  // Bottom action bar
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#dfe3e6',
    paddingVertical: 10,
    paddingHorizontal: 6,
    gap: 5,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    gap: 3,
  },
  actionText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Loading / error
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#6c757d',
    fontSize: 13,
  },
  errorText: {
    fontSize: 15,
    color: '#495057',
    fontWeight: '600',
    marginTop: 8,
  },
  errorBtn: {
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: GREEN,
    borderRadius: 8,
  },
  errorBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});