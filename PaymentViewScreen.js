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
const API_URL = 'https://vagdanam.com/Vighna/gstapi/payment_api.php';
const WEB_BASE = 'https://vagdanam.com/Vighna/gstapi';

export default function PaymentViewScreen({ navigation, route }) {
  const paymentId = route?.params?.paymentId || route?.params?.payment?.id || 0;
  const paymentObj = route?.params?.payment || null;
  const paramType = route?.params?.type || 'inward';

  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState(null);

  const [copies, setCopies] = useState({
    original: true,
    duplicate: true,
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

  /* ---------- Fetch payment ---------- */
  const fetchPayment = useCallback(async () => {
    if (!paymentId) return;
    setLoading(true);
    try {
      const url =
        API_URL +
        '?action=get&id=' +
        encodeURIComponent(paymentId) +
        '&user_id=' +
        encodeURIComponent(currentUserId || '');
      const res = await fetch(url);
      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); } catch { data = null; }

      if (data && data.status === 'success' && data.data) {
        setPayment(data.data);
      } else if (paymentObj) {
        setPayment(paymentObj);
      } else {
        Alert.alert('Error', (data && data.message) || 'Payment not found');
      }
    } catch (e) {
      console.error('fetchPayment:', e);
      if (paymentObj) setPayment(paymentObj);
    } finally {
      setLoading(false);
    }
  }, [paymentId, currentUserId, paymentObj]);

  useEffect(() => { fetchPayment(); }, [fetchPayment]);

  /* ---------- Helpers ---------- */
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
      day: '2-digit', month: 'short', year: 'numeric',
    });
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
    ({ original: 'ORIGINAL FOR RECIPIENT', duplicate: 'DUPLICATE COPY' }[key] || '');

  const amount = n(payment?.amount);
  const words = numberToWords(Math.round(amount)) + ' RUPEES ONLY';
  const paymentTypeUpper = (payment?.payment_type || '').toUpperCase().replace(/_/g, ' ');

  const toggleCopy = (key) => {
    setCopies((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!Object.values(next).some(Boolean)) return prev;
      return next;
    });
  };

  /* ---------- Actions ---------- */
  const shareWhatsApp = () => {
    const url = WEB_BASE + '/list-paymentreceipt.php?type=' + encodeURIComponent(paramType);
    const text = 'Payment Receipt ' + (payment?.receipt_no || '') + ': ' + url;
    Linking.openURL('https://wa.me/?text=' + encodeURIComponent(text)).catch(() =>
      Alert.alert('Error', 'Could not open WhatsApp'));
  };

  const shareEmail = () => {
    const url = WEB_BASE + '/list-paymentreceipt.php?type=' + encodeURIComponent(paramType);
    Linking.openURL(
      'mailto:?subject=' +
        encodeURIComponent('Payment Receipt ' + (payment?.receipt_no || '')) +
        '&body=' +
        encodeURIComponent(url)
    ).catch(() => {});
  };

  const shareSMS = () => {
    const url = WEB_BASE + '/list-paymentreceipt.php?type=' + encodeURIComponent(paramType);
    const sep = Platform.OS === 'ios' ? '&' : '?';
    Linking.openURL('sms:' + sep + 'body=' + encodeURIComponent('Receipt: ' + url)).catch(() => {});
  };

  const printReceipt = () => {
    const url = WEB_BASE + '/list-paymentreceipt.php?type=' + encodeURIComponent(paramType);
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not print'));
  };

  const copyLink = () => {
    const url = WEB_BASE + '/list-paymentreceipt.php?type=' + encodeURIComponent(paramType);
    Clipboard.setString(url);
    Alert.alert('Copied', 'Payment link copied');
  };

  const editPayment = () => {
    navigation?.navigate?.('CreatePayment', {
      userData: sessionUser,
      paymentId: payment?.id,
      mode: 'edit',
      type: paramType,
    });
  };

  /* ---------- Render receipt card ---------- */
  const renderReceipt = (copyKey) => (
    <View style={styles.receiptCard} key={copyKey}>
      {/* Seller header */}
      <View style={styles.sellerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.firmName}>
            {sessionUser?.firm_name || 'Your Firm'}
          </Text>
          {sessionUser?.address ? (
            <Text style={styles.sellerAddr}>{sessionUser.address}</Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {sessionUser?.full_name ? (
            <Text style={styles.sellerMeta}>
              <Text style={styles.bold}>Name: </Text>
              {sessionUser.full_name}
            </Text>
          ) : null}
          {sessionUser?.mobile_no ? (
            <Text style={styles.sellerMeta}>
              <Text style={styles.bold}>Phone: </Text>
              {sessionUser.mobile_no}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Title bar */}
      <View style={styles.titleBar}>
        <Text style={styles.titleText}>RECEIPT VOUCHER</Text>
        <Text style={styles.copyText}>{copyLabel(copyKey)}</Text>
      </View>

      {/* Customer + Receipt meta */}
      <View style={styles.twoCol}>
        <View style={[styles.col, { borderRightWidth: 1 }]}>
          <Text style={styles.sectionLabel}>Customer Details</Text>
          <Row label="Name" value={payment?.company_name || '-'} />
          <Row label="Address" value={payment?.address || '-'} />
          <Row label="GSTIN" value={payment?.gst_pan || '-'} />
          <Row label="State" value="Andhra Pradesh (28)" />
        </View>
        <View style={styles.col}>
          <Row label="Receipt No." value={payment?.receipt_no || '-'} />
          <Row label="Receipt Date" value={formatDate(payment?.payment_date)} />
          <Row label="Payment Type" value={paymentTypeUpper || '-'} />
        </View>
      </View>

      {/* Items header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.th, { width: '10%', textAlign: 'center' }]}>Sr</Text>
        <Text style={[styles.th, { width: '60%' }]}>Particulars</Text>
        <Text style={[styles.th, { width: '30%', textAlign: 'right' }]}>Amount</Text>
      </View>

      {/* Items */}
      <View style={styles.tr}>
        <Text style={[styles.td, { width: '10%', textAlign: 'center' }]}>1</Text>
        <View style={{ width: '60%' }}>
          <Text style={styles.td}>
            <Text style={styles.bold}>Account: </Text>
            {payment?.company_name || '-'}
          </Text>
          {payment?.invoice_no ? (
            <Text style={styles.td}>
              <Text style={styles.bold}>Invoice No.: </Text>
              {payment.invoice_no}
            </Text>
          ) : null}
          <Text style={[styles.td, { marginTop: 3 }]}>
            <Text style={styles.bold}>Through: </Text>
            {paymentTypeUpper || '-'}
          </Text>
        </View>
        <Text
          style={[
            styles.td,
            { width: '30%', textAlign: 'right', fontWeight: '700', backgroundColor: LIGHT_BLUE },
          ]}
        >
          ₹{fmt(amount)}
        </Text>
      </View>

      {/* Totals row */}
      <View style={styles.totalsRow}>
        <Text style={[styles.totalCell, { flex: 1, textAlign: 'right' }]}>Total Amount</Text>
        <Text
          style={[
            styles.totalCell,
            { width: 110, textAlign: 'right', backgroundColor: LIGHT_BLUE, fontWeight: '800' },
          ]}
        >
          ₹{fmt(amount)}
        </Text>
      </View>

      {/* Amount in words */}
      <View style={styles.wordsBox}>
        <Text style={styles.sectionLabel}>Total in words</Text>
        <Text style={styles.wordsText}>{words}</Text>
      </View>

      {/* Terms */}
      <View style={styles.termsBox}>
        <Text style={styles.sectionLabel}>Terms and Conditions</Text>
        <Text style={styles.termsText}>
          {'1. Subject to our home Jurisdiction.\n'}
          {'2. Our Responsibility Ceases as soon as goods leaves our Premises.\n'}
          {'3. Goods once sold will not taken back.'}
        </Text>
      </View>

      {/* Signature */}
      <View style={styles.grandRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionLabel}>
            For {sessionUser?.firm_name || ''}
          </Text>
          <View style={{ height: 40 }} />
          <Text style={styles.signatory}>Authorised Signatory</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.eoe}>(E & O.E.)</Text>
          <Text style={styles.certified}>
            Certified that the particulars given above are true and correct.
          </Text>
        </View>
      </View>

      <Text style={styles.multiHint}>Copy: {copyLabel(copyKey)}</Text>
    </View>
  );

  /* ---------- Guard ---------- */
  if (!paymentId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Ionicons name="alert-circle" size={48} color="#dc3545" />
          <Text style={styles.errorText}>Invalid payment ID</Text>
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
            {payment?.receipt_no || paymentObj?.receipt_no || 'Payment Receipt'}
          </Text>
          <TouchableOpacity style={styles.headerIconBtn} onPress={copyLink}>
            <Ionicons name="copy-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* BODY */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={GREEN} />
            <Text style={styles.loadingText}>Loading receipt…</Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollBody}
            showsVerticalScrollIndicator
          >
            {activeCopies.length === 0
              ? renderReceipt('original')
              : activeCopies.map((k) => renderReceipt(k))}
            <View style={{ height: 20 }} />
          </ScrollView>
        )}

        {/* COPY OPTIONS */}
        <View style={styles.copyBar}>
          {[
            { key: 'original',  label: 'Original'  },
            { key: 'duplicate', label: 'Duplicate' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={styles.copyOption}
              onPress={() => toggleCopy(opt.key)}
              activeOpacity={0.7}
            >
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
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10b981' }]} onPress={printReceipt}>
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

  header: {
    height: 56,
    backgroundColor: GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingTop: StatusBar.currentHeight || 0,
  },
  headerIconBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700', marginHorizontal: 6 },

  scrollBody: { padding: 10 },
  receiptCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BLUE,
  },

  sellerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BLUE,
    paddingBottom: 8,
    marginBottom: 8,
  },
  firmName: { fontSize: 15, fontWeight: '800', color: '#1a1a1a' },
  sellerAddr: { fontSize: 11, color: '#444', marginTop: 2, lineHeight: 15 },
  sellerMeta: { fontSize: 11, color: '#333', marginTop: 2 },
  bold: { fontWeight: '700' },

  titleBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: BLUE,
    marginBottom: 8,
  },
  titleText: { fontSize: 15, fontWeight: '800', color: BLUE, letterSpacing: 0.5, flex: 1 },
  copyText: { fontSize: 10, fontWeight: '700', color: '#333', textAlign: 'right', maxWidth: 130 },

  twoCol: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: BLUE,
    marginBottom: 10,
  },
  col: { flex: 1, borderColor: BLUE, padding: 6 },
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
  rowItem: { flexDirection: 'row', marginBottom: 3 },
  rowLabel: { width: 90, fontSize: 10, fontWeight: '700', color: '#333' },
  rowValue: { flex: 1, fontSize: 11, color: '#1a1a1a' },

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
  th: { fontSize: 10, fontWeight: '800', color: '#1a1a1a' },
  tr: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BLUE,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  td: { fontSize: 11, color: '#1a1a1a' },

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
  totalCell: { fontSize: 11, color: '#1a1a1a' },

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

  termsBox: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BLUE,
    padding: 8,
  },
  termsText: { fontSize: 10, color: '#333', lineHeight: 15, marginTop: 2 },

  grandRow: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BLUE,
    padding: 8,
    alignItems: 'flex-start',
  },
  eoe: { fontSize: 10, fontWeight: '700', color: '#333', marginBottom: 4 },
  certified: { fontSize: 9, color: '#333', textAlign: 'right', maxWidth: 150, lineHeight: 13 },
  signatory: { fontSize: 10, fontWeight: '700', color: '#333', textAlign: 'center' },
  multiHint: { fontSize: 9, color: '#adb5bd', textAlign: 'center', marginTop: 8 },

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
  copyOption: { flexDirection: 'row', alignItems: 'center', gap: 5 },
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
  checkboxChecked: { backgroundColor: '#00b894', borderColor: '#00b894' },
  copyLabel: { fontSize: 11, color: '#4a4a4a', fontWeight: '500' },

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
  actionText: { color: '#fff', fontSize: 9, fontWeight: '700', textAlign: 'center' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  loadingText: { marginTop: 10, color: '#6c757d', fontSize: 13 },
  errorText: { fontSize: 15, color: '#495057', fontWeight: '600', marginTop: 8 },
  errorBtn: {
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: GREEN,
    borderRadius: 8,
  },
  errorBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});