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
  Clipboard,
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

const GREEN = '#187A33';
const BLUE = '#0073CF';
const LIGHT_BLUE = '#E6F2FC';
const API_URL = 'https://vagdanam.com/Vighna/gstapi/purchase_api.php';
const WEB_BASE = 'https://vagdanam.com/Vighna/gstapi';

export default function PurchaseViewScreen({ navigation, route }) {
  const invoiceId = route?.params?.invoiceId || route?.params?.invoice?.id || 0;
  const invoiceObj = route?.params?.invoice || null;

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const [seller, setSeller] = useState(null);
  const [vendorDisplay, setVendorDisplay] = useState({
    name: '', phone: '', gst: '', address: '', placeOfSupply: '',
  });
  const [terms, setTerms] = useState({ title: 'Terms and Conditions', detail: '' });
  const [amountWords, setAmountWords] = useState('');

  const [copies, setCopies] = useState({
    original: true,
    duplicate: false,
    transport: false,
    office: false,
  });

  const [sessionUser, setSessionUser] = useState(
    route?.params?.userData || route?.params?.user || null
  );

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
      try { data = JSON.parse(raw); } catch { data = null; }

      if (data && data.status === 'success' && data.data) {
        setInvoice(data.data.invoice || null);
        setItems(Array.isArray(data.data.items) ? data.data.items : []);
        setSeller(data.data.seller || null);
        if (data.data.terms) setTerms(data.data.terms);

        // Vendor display — use server-resolved fields when present
        const v = data.data.vendor || {};
        setVendorDisplay({
          name:          data.data.vendor_name      || v.companyname || 'Walk-in Vendor',
          phone:         data.data.vendor_phone     || v.contactno1  || 'N/A',
          gst:           data.data.vendor_gst       || v.gstno       || 'N/A',
          address:       data.data.vendor_address   || '',
          placeOfSupply: data.data.place_of_supply  || v.state       || 'N/A',
        });
      } else if (invoiceObj) {
        setInvoice(invoiceObj);
      } else {
        Alert.alert('Error', (data && data.message) || 'Invoice not found');
      }
    } catch (e) {
      console.error('fetchInvoice:', e);
      if (invoiceObj) setInvoice(invoiceObj);
    } finally {
      setLoading(false);
    }
  }, [invoiceId, currentUserId, invoiceObj]);

  useEffect(() => { fetchInvoice(); }, [fetchInvoice]);

  /* ---------------- Helpers ---------------- */
  const n = (v) => Number(v || 0);
  const fmt = (v, d = 2) =>
    n(v).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

  const formatDate = (s) => {
    if (!s) return 'N/A';
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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
    const conv = (x) => {
      if (x < 20) return ones[x];
      if (x < 100) return tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '');
      if (x < 1000) return ones[Math.floor(x / 100)] + ' HUNDRED' + (x % 100 ? ' ' + conv(x % 100) : '');
      if (x < 100000) return conv(Math.floor(x / 1000)) + ' THOUSAND' + (x % 1000 ? ' ' + conv(x % 1000) : '');
      if (x < 10000000) return conv(Math.floor(x / 100000)) + ' LAKH' + (x % 100000 ? ' ' + conv(x % 100000) : '');
      return conv(Math.floor(x / 10000000)) + ' CRORE' + (x % 10000000 ? ' ' + conv(x % 10000000) : '');
    };
    if (num === 0) return 'ZERO';
    return conv(num);
  };

  const copyLabel = (key) =>
    ({
      original:  'ORIGINAL FOR VENDOR',
      duplicate: 'DUPLICATE COPY',
      transport: 'TRIPLICATE FOR TRANSPORT',
      office:    'QUADRUPLICATE FOR OFFICE',
    }[key] || 'ORIGINAL FOR VENDOR');

  const grandTotal = n(invoice?.grand_total);
  const sumQty = items.reduce((s, it) => s + n(it.quantity), 0);
  const sumDisc = items.reduce((s, it) => s + n(it.discount), 0);

  // Matches PHP: numberToWords(round($grand_total)) . ' RUPEES ONLY'
  const words = amountWords || (numberToWords(Math.round(grandTotal)) + ' RUPEES ONLY');

  const toggleCopy = (key) => {
    setCopies((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!Object.values(next).some(Boolean)) return prev;
      return next;
    });
  };

  /* ---------------- Actions ---------------- */
  const shareWhatsApp = () => {
    const url = WEB_BASE + '/view_purchase_invoice.php?id=' + invoiceId;
    const text = 'Purchase Invoice ' + (invoice?.invoice_no || '') + ': ' + url;
    Linking.openURL('https://wa.me/?text=' + encodeURIComponent(text)).catch(() =>
      Alert.alert('Error', 'Could not open WhatsApp'));
  };

  const shareEmail = () => {
    const url = WEB_BASE + '/view_purchase_invoice.php?id=' + invoiceId;
    Linking.openURL(
      'mailto:?subject=' + encodeURIComponent('Purchase Invoice ' + (invoice?.invoice_no || '')) +
      '&body=' + encodeURIComponent(url)
    ).catch(() => {});
  };

  const shareSMS = () => {
    const url = WEB_BASE + '/view_purchase_invoice.php?id=' + invoiceId;
    const sep = Platform.OS === 'ios' ? '&' : '?';
    Linking.openURL('sms:' + sep + 'body=' + encodeURIComponent('Invoice: ' + url)).catch(() => {});
  };

  const downloadInvoice = () => {
    Linking.openURL(WEB_BASE + '/view_purchase_invoice.php?id=' + invoiceId + '&download=1')
      .catch(() => Alert.alert('Error', 'Could not download'));
  };

  const printInvoice = () => {
    Linking.openURL(WEB_BASE + '/view_purchase_invoice.php?id=' + invoiceId + '&print=1')
      .catch(() => Alert.alert('Error', 'Could not print'));
  };

  const copyLink = () => {
    Clipboard.setString(WEB_BASE + '/view_purchase_invoice.php?id=' + invoiceId);
    Alert.alert('Copied', 'Invoice link copied');
  };

  /* ---------------- Render invoice card ---------------- */
  const renderInvoice = (copyKey) => (
    <View style={styles.invoiceCard} key={copyKey}>
      {/* Seller header */}
      <View style={styles.sellerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.firmName}>{seller?.companyname || 'Your Firm'}</Text>
          <Text style={styles.sellerAddr}>
            {[seller?.address1, seller?.address2].filter(Boolean).join('\n')}
          </Text>
          <Text style={styles.sellerAddr}>
            {[seller?.city, seller?.state, seller?.pincode].filter(Boolean).join(', ')}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {seller?.full_name ? (
            <Text style={styles.sellerMeta}><Text style={styles.bold}>Name: </Text>{seller.full_name}</Text>
          ) : null}
          {seller?.contactno1 ? (
            <Text style={styles.sellerMeta}><Text style={styles.bold}>Phone: </Text>{seller.contactno1}</Text>
          ) : null}
          {seller?.gstno ? (
            <Text style={styles.sellerMeta}><Text style={styles.bold}>GST: </Text>{seller.gstno}</Text>
          ) : null}
        </View>
      </View>

      {/* Title bar — matches PHP wording */}
      <View style={styles.titleBar}>
        <Text style={styles.titleText}>PURCHASE TAX INVOICE</Text>
        <Text style={styles.copyText}>{copyLabel(copyKey)}</Text>
      </View>

      {/* Vendor + Invoice meta */}
      <View style={styles.twoCol}>
        <View style={[styles.col, { borderRightWidth: 1 }]}>
          <Text style={styles.sectionLabel}>Vendor Detail</Text>
          <Row label="M/S" value={vendorDisplay.name} />
          <Row label="Address" value={vendorDisplay.address || '-'} />
          <Row label="Phone" value={vendorDisplay.phone} />
          <Row label="GSTIN / PAN" value={vendorDisplay.gst} />
          <Row label="Place of Supply" value={vendorDisplay.placeOfSupply} />
        </View>
        <View style={styles.col}>
          <Row label="Invoice No." value={invoice?.invoice_no || 'N/A'} />
          <Row label="Invoice Date" value={formatDate(invoice?.invoice_date || invoice?.created_at)} />
          <Row label="Due Date" value={invoice?.due_date ? formatDate(invoice.due_date) : 'N/A'} />
        </View>
      </View>

      {/* Items header — 9 columns */}
      <View style={styles.tableHeader}>
        <Text style={[styles.th, { width: '5%',  textAlign: 'center' }]}>Sr</Text>
        <Text style={[styles.th, { width: '28%' }]}>Product</Text>
        <Text style={[styles.th, { width: '9%',  textAlign: 'center' }]}>HSN</Text>
        <Text style={[styles.th, { width: '12%', textAlign: 'center' }]}>Batch</Text>
        <Text style={[styles.th, { width: '10%', textAlign: 'center' }]}>Exp</Text>
        <Text style={[styles.th, { width: '8%',  textAlign: 'center' }]}>Qty</Text>
        <Text style={[styles.th, { width: '10%', textAlign: 'right' }]}>Rate</Text>
        <Text style={[styles.th, { width: '8%',  textAlign: 'right' }]}>Disc</Text>
        <Text style={[styles.th, { width: '10%', textAlign: 'right' }]}>Total</Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyRow}>
          <Text style={styles.emptyText}>No items found in this invoice.</Text>
        </View>
      ) : (
        items.map((it, i) => (
          <View key={String(it.id || i)} style={[styles.tr, i % 2 === 0 && { backgroundColor: '#fafbfc' }]}>
            <Text style={[styles.td, { width: '5%', textAlign: 'center' }]}>{i + 1}</Text>
            <View style={{ width: '28%' }}>
              <Text style={styles.td} numberOfLines={2}>{it.product_name || 'N/A'}</Text>
              {it.product_sku ? <Text style={styles.tdSub}>SKU: {it.product_sku}</Text> : null}
            </View>
            <Text style={[styles.td, { width: '9%',  textAlign: 'center' }]}>{it.hsn_code || ''}</Text>
            <Text style={[styles.td, { width: '12%', textAlign: 'center' }]}>{it.batch_no || it.product_sku || ''}</Text>
            <Text style={[styles.td, { width: '10%', textAlign: 'center' }]}>{formatExpiry(it.expiry_date)}</Text>
            <Text style={[styles.td, { width: '8%',  textAlign: 'center' }]}>{fmt(it.quantity)}</Text>
            <Text style={[styles.td, { width: '10%', textAlign: 'right' }]}>{fmt(it.rate)}</Text>
            <Text style={[styles.td, { width: '8%',  textAlign: 'right' }]}>{fmt(it.discount)}</Text>
            <Text style={[styles.td, { width: '10%', textAlign: 'right', fontWeight: '600' }]}>{fmt(it.line_total)}</Text>
          </View>
        ))
      )}

      {/* Totals row */}
      <View style={styles.totalsRow}>
        <Text style={[styles.totalCell, { flex: 1, textAlign: 'right' }]}>Total</Text>
        <Text style={[styles.totalCell, { width: 55, textAlign: 'center' }]}>{fmt(sumQty)}</Text>
        <Text style={[styles.totalCell, { width: 75, textAlign: 'right' }]}>{fmt(sumDisc)}</Text>
        <Text style={[styles.totalCell, { width: 85, textAlign: 'right', backgroundColor: LIGHT_BLUE, fontWeight: '800' }]}>
          ₹{fmt(grandTotal)}
        </Text>
      </View>

      {/* Amount in words */}
      <View style={styles.wordsBox}>
        <Text style={styles.sectionLabel}>Total in words</Text>
        <Text style={styles.wordsText}>{words}</Text>
      </View>

      {/* Terms */}
      <View style={styles.termsBox}>
        <Text style={styles.sectionLabel}>{terms.title || 'Terms and Conditions'}</Text>
        <Text style={styles.termsText}>{terms.detail}</Text>
      </View>

      {/* Grand total + signatory */}
      <View style={styles.grandRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionLabel}>For {seller?.companyname || ''}</Text>
          <View style={{ height: 40 }} />
          <Text style={styles.signatory}>Authorised Signatory</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.sectionLabel}>Total Amount</Text>
          <Text style={styles.grandTotal}>₹{fmt(grandTotal)}</Text>
          <Text style={styles.eoe}>(E & O.E.)</Text>
        </View>
      </View>

      <Text style={styles.multiHint}>Copy: {copyLabel(copyKey)}</Text>
    </View>
  );

  /* ---------------- Guard ---------------- */
  if (!invoiceId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Ionicons name="alert-circle" size={48} color="#dc3545" />
          <Text style={styles.errorText}>Invalid invoice ID</Text>
          <TouchableOpacity style={styles.errorBtn} onPress={() => navigation?.goBack?.()}>
            <Text style={styles.errorBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const activeCopies = Object.keys(copies).filter((k) => copies[k]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={GREEN} barStyle="light-content" />
      <View style={styles.container}>

        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation?.goBack?.()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {invoice?.invoice_no || invoiceObj?.invoice_no || 'Purchase Invoice'}
          </Text>
          <TouchableOpacity style={styles.headerIconBtn} onPress={copyLink}>
            <Ionicons name="copy-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* BODY */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={GREEN} />
            <Text style={styles.loadingText}>Loading invoice…</Text>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator>
            {activeCopies.length === 0
              ? renderInvoice('original')
              : activeCopies.map((k) => renderInvoice(k))}
            <View style={{ height: 20 }} />
          </ScrollView>
        )}

        {/* COPY OPTIONS */}
        <View style={styles.copyBar}>
          {[
            { key: 'original',  label: 'Original'  },
            { key: 'duplicate', label: 'Duplicate' },
            { key: 'transport', label: 'Transport' },
            { key: 'office',    label: 'Office'    },
          ].map((opt) => (
            <TouchableOpacity key={opt.key} style={styles.copyOption} onPress={() => toggleCopy(opt.key)} activeOpacity={0.7}>
              <View style={[styles.checkbox, copies[opt.key] && styles.checkboxChecked]}>
                {copies[opt.key] && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text style={styles.copyLabel}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* BOTTOM ACTIONS */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#55cf64' }]} onPress={shareWhatsApp}>
            <FontAwesome5 name="whatsapp" size={16} color="#fff" />
            <Text style={styles.actionText}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#ff744d' }]} onPress={shareEmail}>
            <FontAwesome5 name="envelope" size={14} color="#fff" />
            <Text style={styles.actionText}>Email</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#25a9dc' }]} onPress={shareSMS}>
            <FontAwesome5 name="sms" size={15} color="#fff" />
            <Text style={styles.actionText}>SMS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#f5bc22' }]} onPress={downloadInvoice}>
            <FontAwesome5 name="download" size={14} color="#fff" />
            <Text style={styles.actionText}>Download</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10b981' }]} onPress={printInvoice}>
            <FontAwesome5 name="print" size={14} color="#fff" />
            <Text style={styles.actionText}>Print</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#6c757d' }]} onPress={() => navigation?.goBack?.()}>
            <Ionicons name="close" size={16} color="#fff" />
            <Text style={styles.actionText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

/* ---------------- Sub-component ---------------- */
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

  header: {
    height: 56, backgroundColor: GREEN, flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: 6,
    paddingTop: StatusBar.currentHeight || 0,
  },
  headerIconBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700', marginHorizontal: 6 },

  scrollBody: { padding: 10 },
  invoiceCard: {
    backgroundColor: '#fff', borderRadius: 8, padding: 12,
    marginBottom: 14, borderWidth: 1, borderColor: BLUE,
  },

  sellerRow: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BLUE,
    paddingBottom: 8, marginBottom: 8,
  },
  firmName: { fontSize: 15, fontWeight: '800', color: '#1a1a1a' },
  sellerAddr: { fontSize: 11, color: '#444', marginTop: 2, lineHeight: 15 },
  sellerMeta: { fontSize: 11, color: '#333', marginTop: 2 },
  bold: { fontWeight: '700' },

  titleBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: BLUE, marginBottom: 8,
  },
  titleText: { fontSize: 15, fontWeight: '800', color: BLUE, letterSpacing: 0.5, flex: 1 },
  copyText: { fontSize: 10, fontWeight: '700', color: '#333', textAlign: 'right', maxWidth: 130 },

  twoCol: { flexDirection: 'row', borderWidth: 1, borderColor: BLUE, marginBottom: 10 },
  col: { flex: 1, borderColor: BLUE, padding: 6 },
  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: BLUE, backgroundColor: LIGHT_BLUE,
    paddingVertical: 3, paddingHorizontal: 6, marginBottom: 4,
    textAlign: 'center', borderRadius: 3,
  },
  rowItem: { flexDirection: 'row', marginBottom: 3 },
  rowLabel: { width: 95, fontSize: 10, fontWeight: '700', color: '#333' },
  rowValue: { flex: 1, fontSize: 11, color: '#1a1a1a' },

  tableHeader: {
    flexDirection: 'row', backgroundColor: LIGHT_BLUE,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: BLUE,
    paddingVertical: 5, paddingHorizontal: 4,
  },
  th: { fontSize: 9, fontWeight: '800', color: '#1a1a1a' },
  tr: {
    flexDirection: 'row',
    borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: BLUE,
    paddingVertical: 6, paddingHorizontal: 4, alignItems: 'center',
  },
  td: { fontSize: 10, color: '#1a1a1a' },
  tdSub: { fontSize: 9, color: '#6c757d', marginTop: 1 },
  emptyRow: { borderWidth: 1, borderColor: BLUE, padding: 20, alignItems: 'center' },
  emptyText: { fontSize: 12, color: '#6c757d' },

  totalsRow: {
    flexDirection: 'row', backgroundColor: LIGHT_BLUE,
    borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: BLUE,
    paddingVertical: 6, paddingHorizontal: 4, alignItems: 'center',
  },
  totalCell: { fontSize: 11, color: '#1a1a1a' },

  wordsBox: {
    borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: BLUE,
    padding: 8,
  },
  wordsText: {
    fontSize: 11, fontWeight: '700', color: '#1a1a1a',
    textAlign: 'center', marginTop: 2,
  },

  termsBox: {
    borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: BLUE,
    padding: 8,
  },
  termsText: { fontSize: 10, color: '#333', lineHeight: 15, marginTop: 2 },

  grandRow: {
    flexDirection: 'row',
    borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: BLUE,
    padding: 8, alignItems: 'flex-start',
  },
  grandTotal: { fontSize: 18, fontWeight: '800', color: BLUE, marginTop: 2 },
  eoe: { fontSize: 10, fontWeight: '700', color: '#333', marginTop: 2 },
  signatory: { fontSize: 10, fontWeight: '700', color: '#333', textAlign: 'center' },
  multiHint: { fontSize: 9, color: '#adb5bd', textAlign: 'center', marginTop: 8 },

  copyBar: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#dfe3e6',
    paddingVertical: 10, paddingHorizontal: 6,
  },
  copyOption: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  checkbox: {
    width: 18, height: 18, borderRadius: 4, borderWidth: 1.5,
    borderColor: '#adb5bd', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  checkboxChecked: { backgroundColor: '#00b894', borderColor: '#00b894' },
  copyLabel: { fontSize: 11, color: '#4a4a4a', fontWeight: '500' },

  bottomBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#dfe3e6',
    paddingVertical: 10, paddingHorizontal: 6, gap: 5,
  },
  actionBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, borderRadius: 8, gap: 3,
  },
  actionText: { color: '#fff', fontSize: 9, fontWeight: '700', textAlign: 'center' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  loadingText: { marginTop: 10, color: '#6c757d', fontSize: 13 },
  errorText: { fontSize: 15, color: '#495057', fontWeight: '600', marginTop: 8 },
  errorBtn: {
    marginTop: 10, paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: GREEN, borderRadius: 8,
  },
  errorBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});