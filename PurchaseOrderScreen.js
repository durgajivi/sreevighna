import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  StatusBar,
  Dimensions,
  LayoutAnimation,
  UIManager,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

try {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
} catch (e) {}

const { width } = Dimensions.get('window');
const GREEN = '#187A33';
const LIGHT_GREEN = '#f0f7f0';

const API_BASE = 'https://vagdanam.com/Vighna/gstapi';
const VENDORS_API = `${API_BASE}/purchase_api.php`;
const SAVE_URL = `${API_BASE}/ajax_save_purchase_invoice.php`;
const PRODUCTS_API = `${API_BASE}/products_api.php`;

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const emptyRow = () => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  product_id: '',
  name: '',
  sku: '',
  hsn_code: '',
  batch_no: '',
  expiry_date: '',
  uom: 'Pcs',
  qty: '1',
  free_qty: '0',
  price: '0',
  mrp: '0',
  discount: '0',
  cgst_rate: '0',
  sgst_rate: '0',
  line_total: '0',
});

const calcRowTotal = (row) => {
  const qty = Number(row.qty) || 0;
  const price = Number(row.price) || 0;
  const disc = Number(row.discount) || 0;
  const cgst = Number(row.cgst_rate) || 0;
  const sgst = Number(row.sgst_rate) || 0;
  const base = qty * price;
  const afterDisc = base - (base * disc) / 100;
  const total = afterDisc + (afterDisc * (cgst + sgst)) / 100;
  return total;
};

export default function PurchaseOrderScreen({ navigation, route }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);

  const [sessionUser, setSessionUser] = useState(
    route?.params?.userData || route?.params?.user || null
  );
  const [sessionLoaded, setSessionLoaded] = useState(false);

  // ---- VENDOR FIELDS ----
  const [vendorId, setVendorId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [address, setAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [gstNo, setGstNo] = useState('');
  const [reverseCharge, setReverseCharge] = useState('0');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [lutNo, setLutNo] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingAddressId, setShippingAddressId] = useState('');
  const [shippingList, setShippingList] = useState([]);

  // ---- INVOICE HEADER ----
  const [invoicePrefix, setInvoicePrefix] = useState('FIR-PUR');
  const [invoiceId, setInvoiceId] = useState('');
  const [invoicePostfix, setInvoicePostfix] = useState('');
  const [billDate, setBillDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(addDays(15));
  const [currency, setCurrency] = useState('INR - Indian Rupee');
  const [currencyRate, setCurrencyRate] = useState('1');
  const [transportDetails, setTransportDetails] = useState('');

  // ---- ROWS / TOTALS ----
  const [rows, setRows] = useState([emptyRow()]);
  const [roundOff, setRoundOff] = useState(true);
  const [paymentMode, setPaymentMode] = useState('CREDIT');
  const [documentNote, setDocumentNote] = useState('');
  const [termTitle, setTermTitle] = useState('Terms and Conditions');
  const [termDetail, setTermDetail] = useState(
    'Subject to our home Jurisdiction.\nOur Responsibility Ceases as soon as goods leaves our Premises.\nGoods once sold will not taken back.\nDelivery Ex-Premises.'
  );

  // ---- MODALS ----
  const [vendorModal, setVendorModal] = useState(false);
  const [productModal, setProductModal] = useState(false);
  const [activeRowKey, setActiveRowKey] = useState(null);

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
      } finally {
        setSessionLoaded(true);
      }
    })();
  }, []);

  const currentUserId = sessionUser?.id ?? sessionUser?.user_id ?? null;
  const displayName = sessionUser?.full_name || sessionUser?.username || 'User';
  const getInitials = () => (displayName.charAt(0) || 'V').toUpperCase();

  const firmName = sessionUser?.firm_name || 'FIRM';
  const firmPrefix = (() => {
    const letters = firmName.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3);
    return (letters.length < 3 ? letters.padEnd(3, 'X') : letters) + '-PUR';
  })();

  /* ---------------- Load vendors / products ---------------- */
  const loadVendors = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const res = await fetch(
        `${VENDORS_API}?action=search_customers&type=Vendor&term=&user_id=${encodeURIComponent(
          currentUserId
        )}`
      );
      const data = JSON.parse(await res.text());
      if (data?.status === 'success') setVendors(data.data || []);
    } catch (e) {}
  }, [currentUserId]);

  const loadProducts = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const res = await fetch(
        `${PRODUCTS_API}?action=list&user_id=${encodeURIComponent(currentUserId)}`
      );
      const data = JSON.parse(await res.text());
      if (data?.status === 'success') setProducts(data.data || []);
    } catch (e) {}
  }, [currentUserId]);

  useEffect(() => {
    if (!sessionLoaded || !currentUserId) return;
    loadVendors();
    loadProducts();

    setInvoicePrefix(firmPrefix);
    const seq = String(Math.floor(Math.random() * 9000) + 1000);
    setInvoiceId(`${new Date().getFullYear()}-${seq}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoaded, currentUserId]);

  /* ---------------- Shipping address load ---------------- */
  const loadShippingAddresses = async (companyId) => {
    if (!companyId) return;
    try {
      const res = await fetch(
        `${VENDORS_API}?action=get_shipping_addresses&company_id=${encodeURIComponent(
          companyId
        )}&user_id=${encodeURIComponent(currentUserId)}`
      );
      const data = JSON.parse(await res.text());
      if (data?.status === 'success') setShippingList(data.data || []);
    } catch (e) {}
  };

  /* ---------------- Row helpers ---------------- */
  const addRow = () => setRows((r) => [...r, emptyRow()]);

  const removeRow = (key) => {
    setRows((r) => {
      if (r.length === 1) return [emptyRow()];
      return r.filter((row) => row.key !== key);
    });
  };

  const updateRow = (key, patch) => {
    setRows((r) =>
      r.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...patch };
        next.line_total = calcRowTotal(next).toFixed(2);
        return next;
      })
    );
  };

  /* ---------------- Totals ---------------- */
  const totals = rows.reduce(
    (acc, r) => {
      const qty = Number(r.qty) || 0;
      const free = Number(r.free_qty) || 0;
      const price = Number(r.price) || 0;
      const disc = Number(r.discount) || 0;
      const cgst = Number(r.cgst_rate) || 0;
      const sgst = Number(r.sgst_rate) || 0;
      const base = qty * price;
      const taxable = base - (base * disc) / 100;
      acc.qty += qty;
      acc.freeQty += free;
      acc.taxable += taxable;
      acc.cgst += (taxable * cgst) / 100;
      acc.sgst += (taxable * sgst) / 100;
      acc.total += taxable + (taxable * (cgst + sgst)) / 100;
      return acc;
    },
    { qty: 0, freeQty: 0, taxable: 0, cgst: 0, sgst: 0, total: 0 }
  );

  const roundOffValue = roundOff
    ? Math.round(totals.total) - totals.total
    : 0;
  const grandTotal = roundOff ? Math.round(totals.total) : totals.total;

  /* ---------------- Save ---------------- */
  const saveInvoice = async () => {
    if (!vendorId && !vendorName.trim()) {
      Alert.alert('Validation', 'Please select a vendor');
      return;
    }
    const items = rows
      .filter((r) => r.product_id || r.name.trim())
      .map((r) => ({
        product_id: r.product_id,
        product_name: r.name,
        product_sku: r.sku,
        hsn_code: r.hsn_code,
        batch_no: r.batch_no,
        expiry_date: r.expiry_date || null,
        uom: r.uom,
        quantity: Number(r.qty) || 0,
        free_qty: Number(r.free_qty) || 0,
        price: Number(r.price) || 0,
        mrp: Number(r.mrp) || 0,
        discount: Number(r.discount) || 0,
        cgst_rate: Number(r.cgst_rate) || 0,
        sgst_rate: Number(r.sgst_rate) || 0,
        line_total: Number(r.line_total) || 0,
      }));

    if (items.length === 0) {
      Alert.alert('Validation', 'Add at least one product');
      return;
    }

    const payload = {
      user_id: String(currentUserId),
      submittype: 'save',
      invoice_mode: 'purchase',

      ms: vendorId || '',
      hidden_companyname: vendorName,
      address: address,
      cmp_contactperson: contactPerson,
      cmp_contactno: phone,
      cmp_gstno: gstNo,
      reverse_Charge: reverseCharge,
      PlaceofSupply: placeOfSupply,
      lut_no: lutNo,

      shippingAddress: shippingAddress,
      shipping_address_id: shippingAddressId,

      invoice_prefix: invoicePrefix,
      invoice_id: invoiceId,
      invoice_postfix: invoicePostfix,
      bill_date: billDate,
      due_date: dueDate,
      currency: currency,
      currency_rate: currencyRate,
      transport_detils: transportDetails,

      subtotal: totals.taxable.toFixed(2),
      total_taxable: totals.taxable.toFixed(2),
      total_tax: (totals.cgst + totals.sgst).toFixed(2),
      hidden_round_off_value: roundOffValue.toFixed(2),
      grand_total: grandTotal.toFixed(2),
      total_to_qty: totals.qty.toFixed(2),
      roundoff: roundOff ? '1' : '0',

      payment: paymentMode,

      document_note: documentNote,
      banktc: [{ term_title: termTitle, term_detail: termDetail }],

      items,
    };

    try {
      setSaving(true);
      const res = await fetch(SAVE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }

      if (data?.status === 'success') {
        Alert.alert('Success', data.message || 'Purchase invoice saved', [
          {
            text: 'OK',
            onPress: () => {
              navigation?.navigate?.('Purchase', { userData: sessionUser });
            },
          },
        ]);
      } else {
        Alert.alert('Error', data?.message || 'Save failed');
      }
    } catch (e) {
      Alert.alert('Network error', e.message);
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- Navigation ---------------- */
  const goTo = (screen, params = {}) => {
    setMenuOpen(false);
    navigation?.navigate?.(screen, { userData: sessionUser, ...params });
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await SecureStore.deleteItemAsync('user_session').catch(() => {});
    navigation?.replace?.('Login');
  };

  const toggleAccordion = (name) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenDropdown(openDropdown === name ? null : name);
  };

  /* ====================================================================== */
  /*  UI                                                                    */
  /* ====================================================================== */
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar backgroundColor={GREEN} barStyle="light-content" />
      <View style={styles.appContainer}>

        {/* TOP BAR */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.menuButton} onPress={() => setMenuOpen(true)}>
            <Ionicons name="menu" size={27} color="#fff" />
          </TouchableOpacity>
          <View style={styles.brandContainer}>
            <MaterialCommunityIcons name="heartbeat" size={22} color="#fff" />
            <View style={{ marginLeft: 6 }}>
              <Text style={styles.brandText} numberOfLines={1}>
                {sessionUser?.firm_name || 'Vagdanam Bill-Soft'}
              </Text>
              <Text style={styles.brandSubText} numberOfLines={1}>
                {displayName}
              </Text>
            </View>
          </View>
          <View style={styles.topActions}>
            <TouchableOpacity style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials()}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.mainContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* PAGE HEADER */}
          <View style={styles.pageHeader}>
            <TouchableOpacity style={styles.backBtn} onPress={() => goTo('Purchase')}>
              <Ionicons name="arrow-back" size={18} color={GREEN} />
            </TouchableOpacity>
            <View style={styles.pageTitleContainer}>
              <FontAwesome5 name="file-invoice" size={16} color={GREEN} />
              <Text style={styles.pageTitle}>New Purchase Invoice</Text>
            </View>
          </View>

          {/* ================= VENDOR INFORMATION ================= */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Vendor Information</Text>

            <Text style={styles.inputLabel}>Vendor *</Text>
            <TouchableOpacity
              style={styles.selectBtn}
              onPress={() => setVendorModal(true)}
            >
              <Text
                style={[
                  styles.selectBtnText,
                  !vendorName && { color: '#adb5bd' },
                ]}
                numberOfLines={1}
              >
                {vendorName || 'Search vendor by name, phone or GST...'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#666" />
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Address</Text>
            <TextInput
              style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
              value={address}
              onChangeText={setAddress}
              placeholder="Enter address"
              placeholderTextColor="#adb5bd"
              multiline
            />

            <Text style={styles.inputLabel}>Contact Person</Text>
            <TextInput
              style={styles.input}
              value={contactPerson}
              onChangeText={setContactPerson}
              placeholder="Contact Person"
              placeholderTextColor="#adb5bd"
            />

            <Text style={styles.inputLabel}>Phone No</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone No"
              placeholderTextColor="#adb5bd"
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>GSTIN / PAN</Text>
            <TextInput
              style={styles.input}
              value={gstNo}
              onChangeText={setGstNo}
              placeholder="GSTIN / PAN"
              placeholderTextColor="#adb5bd"
              autoCapitalize="characters"
            />

            <Text style={styles.inputLabel}>Reverse Charge</Text>
            <View style={styles.chipsRow}>
              {[
                { label: 'No', value: '0' },
                { label: 'Yes', value: '1' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.chip,
                    reverseCharge === opt.value && styles.chipActive,
                  ]}
                  onPress={() => setReverseCharge(opt.value)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      reverseCharge === opt.value && styles.chipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Place of Supply *</Text>
            <TextInput
              style={styles.input}
              value={placeOfSupply}
              onChangeText={setPlaceOfSupply}
              placeholder="Enter Place of Supply"
              placeholderTextColor="#adb5bd"
            />

            <Text style={styles.inputLabel}>DL No.</Text>
            <TextInput
              style={styles.input}
              value={lutNo}
              onChangeText={setLutNo}
              placeholder="Enter LUT No."
              placeholderTextColor="#adb5bd"
            />
          </View>

          {/* ================= INVOICE DETAILS ================= */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Purchase Invoice Detail</Text>

            <Text style={styles.inputLabel}>Invoice No *</Text>
            <View style={styles.invoiceRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={invoicePrefix}
                onChangeText={setInvoicePrefix}
                placeholder="Prefix"
                placeholderTextColor="#adb5bd"
              />
              <TextInput
                style={[styles.input, { flex: 1.5, marginLeft: 6 }]}
                value={invoiceId}
                onChangeText={setInvoiceId}
                placeholder="Inv No."
                placeholderTextColor="#adb5bd"
              />
              <TextInput
                style={[styles.input, { flex: 1, marginLeft: 6 }]}
                value={invoicePostfix}
                onChangeText={setInvoicePostfix}
                placeholder="Post"
                placeholderTextColor="#adb5bd"
              />
            </View>

            <Text style={styles.inputLabel}>Invoice Date *</Text>
            <TextInput
              style={styles.input}
              value={billDate}
              onChangeText={setBillDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#adb5bd"
            />

            <Text style={styles.inputLabel}>Due Date</Text>
            <TextInput
              style={styles.input}
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#adb5bd"
            />

            <Text style={styles.inputLabel}>Currency</Text>
            <View style={styles.chipsRow}>
              {[
                'INR - Indian Rupee',
                'USD - US Dollar',
                'EUR - Euro',
                'GBP - Pound Sterling',
              ].map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, currency === c && styles.chipActive]}
                  onPress={() => setCurrency(c)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      currency === c && styles.chipTextActive,
                    ]}
                  >
                    {c.split(' - ')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {currency !== 'INR - Indian Rupee' && (
              <>
                <Text style={styles.inputLabel}>1 INR =</Text>
                <TextInput
                  style={styles.input}
                  value={currencyRate}
                  onChangeText={setCurrencyRate}
                  placeholder="Conversion factor"
                  placeholderTextColor="#adb5bd"
                  keyboardType="numeric"
                />
              </>
            )}

            <Text style={styles.inputLabel}>Delivery</Text>
            <View style={styles.chipsRow}>
              {[
                'Hand Delivery',
                'Transport / Road - Regular',
                'Road - Over Dimensional Cargo',
                'Rail',
                'Air',
                'Ship',
              ].map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.chip,
                    transportDetails === d && styles.chipActive,
                  ]}
                  onPress={() => setTransportDetails(d)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      transportDetails === d && styles.chipTextActive,
                    ]}
                  >
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ================= PRODUCTS ================= */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Product Items</Text>
              <TouchableOpacity style={styles.addRowBtn} onPress={addRow}>
                <FontAwesome5 name="plus" size={11} color="#fff" />
                <Text style={styles.addRowText}>Add Row</Text>
              </TouchableOpacity>
            </View>

            {rows.map((row, idx) => (
              <View key={row.key} style={styles.rowCard}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowNum}>#{idx + 1}</Text>
                  <TouchableOpacity onPress={() => removeRow(row.key)}>
                    <Ionicons name="trash-outline" size={18} color="#dc3545" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabelSmall}>Product</Text>
                <TouchableOpacity
                  style={styles.selectBtnSmall}
                  onPress={() => {
                    setActiveRowKey(row.key);
                    setProductModal(true);
                  }}
                >
                  <Text
                    style={[
                      styles.selectBtnTextSmall,
                      !row.name && { color: '#adb5bd' },
                    ]}
                    numberOfLines={1}
                  >
                    {row.name || 'Select Product'}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color="#666" />
                </TouchableOpacity>

                <View style={styles.gridTwo}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabelSmall}>HSN</Text>
                    <TextInput
                      style={styles.inputSmall}
                      value={row.hsn_code}
                      onChangeText={(v) => updateRow(row.key, { hsn_code: v })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabelSmall}>Batch No</Text>
                    <TextInput
                      style={styles.inputSmall}
                      value={row.batch_no}
                      onChangeText={(v) => updateRow(row.key, { batch_no: v })}
                    />
                  </View>
                </View>

                <View style={styles.gridTwo}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabelSmall}>Expiry Date</Text>
                    <TextInput
                      style={styles.inputSmall}
                      value={row.expiry_date}
                      onChangeText={(v) => updateRow(row.key, { expiry_date: v })}
                      placeholder="YYYY-MM-DD"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabelSmall}>UOM</Text>
                    <TextInput
                      style={styles.inputSmall}
                      value={row.uom}
                      onChangeText={(v) => updateRow(row.key, { uom: v })}
                    />
                  </View>
                </View>

                <View style={styles.gridThree}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabelSmall}>Qty</Text>
                    <TextInput
                      style={styles.inputSmall}
                      value={row.qty}
                      onChangeText={(v) => updateRow(row.key, { qty: v })}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabelSmall}>Free</Text>
                    <TextInput
                      style={styles.inputSmall}
                      value={row.free_qty}
                      onChangeText={(v) => updateRow(row.key, { free_qty: v })}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabelSmall}>Price</Text>
                    <TextInput
                      style={styles.inputSmall}
                      value={row.price}
                      onChangeText={(v) => updateRow(row.key, { price: v })}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.gridThree}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabelSmall}>MRP</Text>
                    <TextInput
                      style={styles.inputSmall}
                      value={row.mrp}
                      onChangeText={(v) => updateRow(row.key, { mrp: v })}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabelSmall}>Disc %</Text>
                    <TextInput
                      style={styles.inputSmall}
                      value={row.discount}
                      onChangeText={(v) => updateRow(row.key, { discount: v })}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabelSmall}>CGST %</Text>
                    <TextInput
                      style={styles.inputSmall}
                      value={row.cgst_rate}
                      onChangeText={(v) => updateRow(row.key, { cgst_rate: v })}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.gridTwo}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabelSmall}>SGST %</Text>
                    <TextInput
                      style={styles.inputSmall}
                      value={row.sgst_rate}
                      onChangeText={(v) => updateRow(row.key, { sgst_rate: v })}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabelSmall}>Line Total</Text>
                    <TextInput
                      style={[styles.inputSmall, { backgroundColor: '#f1f3f5' }]}
                      value={row.line_total}
                      editable={false}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* ================= TOTALS ================= */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Summary</Text>
            <SummaryRow label="Total Qty" value={totals.qty.toFixed(2)} />
            <SummaryRow label="Total Free Qty" value={totals.freeQty.toFixed(2)} />
            <SummaryRow label="Taxable" value={'Rs ' + totals.taxable.toFixed(2)} />
            <SummaryRow label="CGST" value={'Rs ' + totals.cgst.toFixed(2)} />
            <SummaryRow label="SGST" value={'Rs ' + totals.sgst.toFixed(2)} />

            <View style={styles.roundRow}>
              <Text style={styles.roundLabel}>Round Off</Text>
              <TouchableOpacity
                style={[
                  styles.toggle,
                  roundOff && { backgroundColor: GREEN },
                ]}
                onPress={() => setRoundOff(!roundOff)}
              >
                <View
                  style={[
                    styles.toggleKnob,
                    roundOff && { alignSelf: 'flex-end' },
                  ]}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>Grand Total</Text>
              <Text style={styles.grandValue}>
                Rs {grandTotal.toFixed(2)}
              </Text>
            </View>

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Payment Type *</Text>
            <View style={styles.chipsRow}>
              {['CREDIT', 'CASH', 'CHEQUE', 'ONLINE'].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.chip, paymentMode === m && styles.chipActive]}
                  onPress={() => setPaymentMode(m)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      paymentMode === m && styles.chipTextActive,
                    ]}
                  >
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ================= TERMS & NOTES ================= */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Terms & Condition / Notes</Text>

            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.input}
              value={termTitle}
              onChangeText={setTermTitle}
              placeholder="Title"
              placeholderTextColor="#adb5bd"
            />

            <Text style={styles.inputLabel}>Detail</Text>
            <TextInput
              style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
              value={termDetail}
              onChangeText={setTermDetail}
              multiline
              placeholder="Terms"
              placeholderTextColor="#adb5bd"
            />

            <Text style={styles.inputLabel}>Document Note / Remarks</Text>
            <TextInput
              style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
              value={documentNote}
              onChangeText={setDocumentNote}
              multiline
              placeholder="Internal notes..."
              placeholderTextColor="#adb5bd"
            />
          </View>

          {/* SAVE */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={saveInvoice}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <FontAwesome5 name="save" size={14} color="#fff" />
                <Text style={styles.saveBtnText}>Save Purchase Invoice</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* ============= VENDOR PICKER MODAL ============= */}
        <Modal
          visible={vendorModal}
          animationType="slide"
          transparent
          onRequestClose={() => setVendorModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Vendor</Text>
                <TouchableOpacity onPress={() => setVendorModal(false)}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalBody}>
                {vendors.length === 0 ? (
                  <Text style={styles.noDataText}>No vendors found.</Text>
                ) : (
                  vendors.map((v) => (
                    <TouchableOpacity
                      key={String(v.id)}
                      style={styles.pickRow}
                      onPress={() => {
                        setVendorId(String(v.id));
                        setVendorName(v.companyname || v.label || v.value || '');
                        setAddress(v.address1 || '');
                        setContactPerson(v.contactperson || '');
                        setPhone(v.contactno1 || '');
                        setGstNo(v.gstno || '');
                        setPlaceOfSupply(v.state || '');
                        loadShippingAddresses(v.id);
                        setVendorModal(false);
                      }}
                    >
                      <Text style={styles.pickTitle}>
                        {v.companyname || v.label || v.value}
                      </Text>
                      {!!v.contactno1 && (
                        <Text style={styles.pickSub}>{v.contactno1}</Text>
                      )}
                      {!!v.gstno && (
                        <Text style={styles.pickSub}>GST: {v.gstno}</Text>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ============= PRODUCT PICKER MODAL ============= */}
        <Modal
          visible={productModal}
          animationType="slide"
          transparent
          onRequestClose={() => setProductModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Product</Text>
                <TouchableOpacity onPress={() => setProductModal(false)}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalBody}>
                {products.length === 0 ? (
                  <Text style={styles.noDataText}>No products found.</Text>
                ) : (
                  products.map((p) => (
                    <TouchableOpacity
                      key={String(p.id)}
                      style={styles.pickRow}
                      onPress={() => {
                        const gst = Number(p.gst_rate) || 0;
                        const half = (gst / 2).toFixed(2);
                        updateRow(activeRowKey, {
                          product_id: String(p.id),
                          name: p.name,
                          sku: p.sku || '',
                          hsn_code: p.hsn_code || '',
                          batch_no: p.batch_no || p.sku || '',
                          expiry_date: p.expiry_date || '',
                          uom: p.uom || 'Pcs',
                          price: String(p.purchase_price || p.sell_price || 0),
                          mrp: String(p.price || p.sell_price || 0),
                          cgst_rate: half,
                          sgst_rate: half,
                        });
                        setProductModal(false);
                      }}
                    >
                      <Text style={styles.pickTitle}>{p.name}</Text>
                      <Text style={styles.pickSub}>
                        SKU: {p.sku || '-'} · UOM: {p.uom || 'Pcs'}
                      </Text>
                      <Text style={styles.pickSub}>
                        Price: Rs {p.purchase_price || 0} · MRP: Rs {p.price || 0} · GST:{' '}
                        {p.gst_rate || 0}%
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ============= DRAWER ============= */}
        {menuOpen && (
          <View style={styles.menuOverlay}>
            <TouchableOpacity
              style={styles.overlayBackground}
              activeOpacity={1}
              onPress={() => setMenuOpen(false)}
            />
            <View style={styles.drawer}>
              <View style={styles.drawerHeader}>
                <View style={styles.drawerBrandIcon}>
                  <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>
                    {getInitials()}
                  </Text>
                </View>
                <View style={styles.drawerBrandTextContainer}>
                  <Text style={styles.drawerTitle} numberOfLines={1}>
                    {sessionUser?.firm_name || displayName}
                  </Text>
                  <Text style={styles.drawerSubtitle} numberOfLines={1}>
                    {displayName} | {sessionUser?.role || 'User'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setMenuOpen(false)}>
                  <Ionicons name="close" size={25} color="#fff" />
                </TouchableOpacity>
              </View>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
              >
                <MenuItem icon="view-dashboard-outline" title="Dashboard" onPress={() => goTo('Dashboard')} />
                <MenuDivider />
                <MenuDropdownHeader
                  icon="account-group"
                  title="Customer / Vendor"
                  isOpen={openDropdown === 'customer'}
                  onPress={() => toggleAccordion('customer')}
                />
                {openDropdown === 'customer' && (
                  <View style={styles.dropdownContainer}>
                    <MenuSubItem title="Customer / Vendor" onPress={() => goTo('CustomerScreen')} />
                  </View>
                )}
                <MenuDropdownHeader
                  icon="package-variant-closed"
                  title="Products"
                  isOpen={openDropdown === 'products'}
                  onPress={() => toggleAccordion('products')}
                />
                {openDropdown === 'products' && (
                  <View style={styles.dropdownContainer}>
                    <MenuSubItem title="Company Name" onPress={() => goTo('Company')} />
                    <MenuSubItem title="Category" onPress={() => goTo('Category')} />
                    <MenuSubItem title="Products" onPress={() => goTo('Products')} />
                  </View>
                )}
                <MenuItem icon="file-document-outline" title="Sale Invoice" onPress={() => goTo('Sales')} />
                <MenuItem icon="file-document-edit-outline" title="Purchase Invoice" onPress={() => goTo('Purchase')} />
                <MenuDivider />
                <MenuItem icon="logout" title="Logout" onPress={handleLogout} />
              </ScrollView>
            </View>
          </View>
        )}

        {/* BOTTOM NAV */}
        <View style={styles.bottomNavigation}>
          <TouchableOpacity style={styles.bottomItem} onPress={() => goTo('Dashboard')}>
            <Ionicons name="home-outline" size={22} color="#666" />
            <Text style={styles.bottomLabel}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomItem} onPress={() => goTo('CustomerScreen')}>
            <Ionicons name="people-outline" size={22} color="#666" />
            <Text style={styles.bottomLabel}>Customer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomItem} onPress={() => goTo('Category')}>
            <MaterialCommunityIcons name="shape-outline" size={22} color="#666" />
            <Text style={styles.bottomLabel}>Category</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomItem} onPress={() => goTo('Purchase')}>
            <MaterialCommunityIcons name="cart-arrow-down" size={22} color={GREEN} />
            <Text style={[styles.bottomLabel, { color: GREEN }]}>Purchase</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

/* ---------------- SUBCOMPONENTS ---------------- */
function SummaryRow({ label, value }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}
function MenuItem({ icon, title, onPress, active = false }) {
  return (
    <TouchableOpacity style={[styles.menuItem, active && styles.menuItemActive]} onPress={onPress} activeOpacity={0.7}>
      <MaterialCommunityIcons name={icon} size={20} color={active ? GREEN : '#555'} />
      <Text style={[styles.menuItemText, active && styles.menuItemTextActive]}>{title}</Text>
      <Ionicons name="chevron-forward" size={15} color="#adb5bd" />
    </TouchableOpacity>
  );
}
function MenuDropdownHeader({ icon, title, isOpen, onPress }) {
  return (
    <TouchableOpacity style={styles.menuSection} onPress={onPress} activeOpacity={0.7}>
      <MaterialCommunityIcons name={icon} size={20} color={GREEN} />
      <Text style={styles.menuSectionText}>{title}</Text>
      <Ionicons name={isOpen ? 'chevron-down' : 'chevron-forward'} size={16} color="#adb5bd" />
    </TouchableOpacity>
  );
}
function MenuSubItem({ title, onPress }) {
  return (
    <TouchableOpacity style={styles.menuSubItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.subDot} />
      <Text style={styles.menuSubText}>{title}</Text>
    </TouchableOpacity>
  );
}
function MenuDivider() {
  return <View style={styles.menuDivider} />;
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: GREEN },
  appContainer: { flex: 1, backgroundColor: '#f4f6f9' },

  // ✅ FIXED — no manual StatusBar padding
  topBar: {
    minHeight: 58,
    backgroundColor: GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  menuButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  brandContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 5 },
  brandText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  brandSubText: { color: '#b7dfbe', fontSize: 10, fontWeight: '500' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: GREEN, fontSize: 14, fontWeight: '800' },

  mainContent: { padding: 14 },

  pageHeader: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: LIGHT_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  pageTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  pageTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: GREEN,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addRowText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4a4a4a',
    marginTop: 10,
    marginBottom: 4,
  },
  inputLabelSmall: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4a4a4a',
    marginTop: 6,
    marginBottom: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    backgroundColor: '#fafbfc',
    color: '#1a1a1a',
  },
  inputSmall: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    backgroundColor: '#fafbfc',
    color: '#1a1a1a',
  },

  invoiceRow: { flexDirection: 'row', marginTop: 2 },

  selectBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fafbfc',
  },
  selectBtnText: { fontSize: 13, color: '#1a1a1a', flex: 1 },
  selectBtnSmall: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fafbfc',
  },
  selectBtnTextSmall: { fontSize: 12, color: '#1a1a1a', flex: 1 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ced4da',
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: GREEN, borderColor: GREEN },
  chipText: { fontSize: 11, color: '#495057', fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  gridTwo: { flexDirection: 'row', gap: 8, marginTop: 4 },
  gridThree: { flexDirection: 'row', gap: 8, marginTop: 4 },

  rowCard: {
    borderWidth: 1,
    borderColor: '#eef0f2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#fcfdfc',
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  rowNum: { fontSize: 12, fontWeight: '700', color: GREEN },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
  },
  summaryLabel: { fontSize: 13, color: '#495057' },
  summaryValue: { fontSize: 13, color: '#212529', fontWeight: '600' },

  roundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  roundLabel: { fontSize: 13, fontWeight: '600', color: '#495057' },
  toggle: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ccc',
    padding: 3,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },

  grandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: GREEN,
  },
  grandLabel: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  grandValue: { fontSize: 17, fontWeight: '700', color: GREEN },

  saveBtn: {
    backgroundColor: GREEN,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  bottomNavigation: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 10,
  },
  bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottomLabel: { fontSize: 10, color: '#495057', fontWeight: '600', marginTop: 2 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 14,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  modalHeader: {
    backgroundColor: GREEN,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalBody: { padding: 12 },
  noDataText: { textAlign: 'center', color: '#868e96', marginVertical: 20 },
  pickRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
  },
  pickTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  pickSub: { fontSize: 11, color: '#6c757d', marginTop: 2 },

  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    zIndex: 1000,
  },
  overlayBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: Math.min(width * 0.84, 330),
    backgroundColor: '#fff',
    elevation: 20,
  },

  // ✅ FIXED — no Platform-specific top padding
  drawerHeader: {
    backgroundColor: GREEN,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  drawerBrandIcon: {
    width: 43,
    height: 43,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerBrandTextContainer: { flex: 1, marginLeft: 10 },
  drawerTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  drawerSubtitle: { color: '#b7dfbe', fontSize: 10, marginTop: 2 },

  menuItem: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
  },
  menuItemActive: { backgroundColor: LIGHT_GREEN, borderLeftWidth: 3, borderLeftColor: GREEN },
  menuItemText: { flex: 1, marginLeft: 13, fontSize: 13, color: '#495057', fontWeight: '500' },
  menuItemTextActive: { color: GREEN, fontWeight: '700' },
  menuSection: {
    minHeight: 47,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    backgroundColor: '#fafcfb',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
  },
  menuSectionText: { flex: 1, marginLeft: 13, fontSize: 13, color: '#343a40', fontWeight: '700' },
  dropdownContainer: { backgroundColor: '#f8f9fa', paddingVertical: 2 },
  menuSubItem: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 46,
    paddingRight: 18,
  },
  subDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#adb5bd', marginRight: 11 },
  menuSubText: { flex: 1, fontSize: 12, color: '#6c757d' },
  menuDivider: { height: 1, backgroundColor: '#e9ecef', marginVertical: 6 },
});