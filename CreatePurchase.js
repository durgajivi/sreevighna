import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView, 
  TextInput, 
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Platform,
  StatusBar,
  Dimensions,
  LayoutAnimation,
  UIManager
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as SecureStore from 'expo-secure-store';

// Enable LayoutAnimation for Android smooth drawer toggling
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get("window");
const GREEN = "#187A33";
const LIGHT_GREEN = "#f0f7f0";

export default function CreatePurchaseScreen({ navigation, route }) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Session State
  const [sessionUser, setSessionUser] = useState(route?.params?.userData || route?.params?.user || { id: 1 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);

  // Vendor State
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorList, setVendorList] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);

  // Invoice Header Fields
  const [invoicePrefix, setInvoicePrefix] = useState('PUR');
  const [invoiceId, setInvoiceId] = useState('2026-0001');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 15*24*60*60*1000).toISOString().split('T')[0]);
  const [paymentType, setPaymentType] = useState('CREDIT');
  const [placeOfSupply, setPlaceOfSupply] = useState('Andhra Pradesh');
  const [documentNote, setDocumentNote] = useState('');

  // Date Picker States
  const [showInvoiceDatePicker, setShowInvoiceDatePicker] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);

  // Product Items Rows State (Full feature set matching PHP form)
  const [items, setItems] = useState([
    { 
      id: 1, 
      product_id: '', 
      name: '', 
      hsn_code: '', 
      batch_no: '', 
      expiry_date: '', 
      uom: 'Pcs', 
      qty: '1', 
      free_qty: '0', 
      price: '0.00', 
      mrp: '0.00', 
      disc: '0', 
      cgst: '0', 
      sgst: '0', 
      total: '0.00' 
    }
  ]);

  // Product Autocomplete Modal/Dropdown per row state
  const [activeRowIndex, setActiveRowIndex] = useState(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productList, setProductList] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Load SecureStore session if not passed via route params
  useEffect(() => {
    const loadSession = async () => {
      try {
        const storedSession = await SecureStore.getItemAsync('user_session');
        if (storedSession) {
          setSessionUser(JSON.parse(storedSession));
        }
      } catch (error) {
        console.error("Failed to load session:", error);
      }
    };
    loadSession();
  }, []);

  const currentUserId = sessionUser.user_code || sessionUser.id || 1;

  const goTo = (screen, params = {}) => {
    setMenuOpen(false);
    if (navigation?.navigate) {
      navigation.navigate(screen, { userData: sessionUser, ...params });
    }
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await SecureStore.deleteItemAsync('user_session');
    } catch (error) {
      console.error("Failed to clear session:", error);
    }
    if (navigation?.replace) {
      navigation.replace("Login");
    }
  };

  const toggleAccordion = (dropdownName) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenDropdown(openDropdown === dropdownName ? null : dropdownName);
  };

  // Search Vendors from Database filtered by user_id
  const searchVendors = async (term) => {
    setVendorSearch(term);
    if (!term || term.length < 2) {
      setVendorList([]);
      setShowVendorDropdown(false);
      return;
    }
    try {
      const response = await fetch(`https://vagdanam.com/gstapi/get_companies.php?user_id=${currentUserId}&search=${encodeURIComponent(term)}`);
      const text = await response.text();
      const result = JSON.parse(text);
      if (result.status === 'success') {
        setVendorList(result.data || []);
        setShowVendorDropdown(true);
      }
    } catch (err) {
      console.error('Vendor search error:', err);
    }
  };

  // Search Products for a specific item row
  const searchProductsForRow = async (index, term) => {
    setActiveRowIndex(index);
    setProductSearchTerm(term);
    updateItemField(index, 'name', term);

    if (!term || term.length < 2) {
      setProductList([]);
      setShowProductDropdown(false);
      return;
    }

    try {
      const response = await fetch(`https://vagdanam.com/gstapi/get_products.php?user_id=${currentUserId}&search=${encodeURIComponent(term)}`);
      const text = await response.text();
      const result = JSON.parse(text);
      if (result.status === 'success') {
        setProductList(result.data || []);
        setShowProductDropdown(true);
      }
    } catch (err) {
      console.error('Product search error:', err);
    }
  };

  const selectProductForRow = (index, product) => {
    const updated = [...items];
    updated[index].product_id = product.id || '';
    updated[index].name = product.name || '';
    updated[index].hsn_code = product.hsn_code || '';
    updated[index].batch_no = product.sku || '';
    updated[index].uom = product.uom || 'Pcs';
    
    const priceVal = parseFloat(product.sell_price || product.price || 0);
    updated[index].price = priceVal.toFixed(2);
    updated[index].mrp = priceVal.toFixed(2);

    const gstRate = parseFloat(product.gst_rate || 0);
    const splitTax = (gstRate / 2).toFixed(2);
    updated[index].cgst = splitTax;
    updated[index].sgst = splitTax;

    // Recalculate row total
    const qty = parseFloat(updated[index].qty) || 1;
    const disc = parseFloat(updated[index].disc) || 0;
    let subtotal = qty * priceVal;
    let discAmount = (subtotal * disc) / 100;
    let taxable = subtotal - discAmount;
    let taxAmount = (taxable * gstRate) / 100;
    updated[index].total = (taxable + taxAmount).toFixed(2);

    setItems(updated);
    setShowProductDropdown(false);
    setActiveRowIndex(null);
  };

  // Add Product Item Row
  const addProductRow = () => {
    setItems([...items, { 
      id: items.length + 1, 
      product_id: '', 
      name: '', 
      hsn_code: '', 
      batch_no: '', 
      expiry_date: '', 
      uom: 'Pcs', 
      qty: '1', 
      free_qty: '0', 
      price: '0.00', 
      mrp: '0.00', 
      disc: '0', 
      cgst: '0', 
      sgst: '0', 
      total: '0.00' 
    }]);
  };

  // Remove Product Item Row
  const removeProductRow = (index) => {
    if (items.length === 1) {
      alert('At least one item row is required.');
      return;
    }
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  // Update Item Field Value & Calculate Total
  const updateItemField = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;

    const qty = parseFloat(updated[index].qty) || 0;
    const price = parseFloat(updated[index].price) || 0;
    const disc = parseFloat(updated[index].disc) || 0;
    const cgst = parseFloat(updated[index].cgst) || 0;
    const sgst = parseFloat(updated[index].sgst) || 0;

    let subtotal = qty * price;
    let discAmount = (subtotal * disc) / 100;
    let taxable = subtotal - discAmount;
    let taxAmount = (taxable * (cgst + sgst)) / 100;
    updated[index].total = (taxable + taxAmount).toFixed(2);

    setItems(updated);
  };

  // Calculate Grand Totals
  const calculateTotals = () => {
    let subtotal = 0;
    let totalTaxable = 0;
    let totalTax = 0;
    let totalQty = 0;
    let totalFreeQty = 0;

    items.forEach(item => {
      const qty = parseFloat(item.qty) || 0;
      const freeQty = parseFloat(item.free_qty) || 0;
      const price = parseFloat(item.price) || 0;
      const disc = parseFloat(item.disc) || 0;
      const cgst = parseFloat(item.cgst) || 0;
      const sgst = parseFloat(item.sgst) || 0;

      const rowSub = qty * price;
      const discAmount = (rowSub * disc) / 100;
      const taxable = rowSub - discAmount;
      const tax = (taxable * (cgst + sgst)) / 100;

      subtotal += rowSub;
      totalTaxable += taxable;
      totalTax += tax;
      totalQty += qty;
      totalFreeQty += freeQty;
    });

    const grandTotal = Math.round(totalTaxable + totalTax);
    return { subtotal, totalTaxable, totalTax, grandTotal, totalQty, totalFreeQty };
  };

  const totals = calculateTotals();

  // Convert Number to Words (Indian Currency format)
  const numberToWords = (num) => {
    if (num === 0) return 'ZERO RUPEES ONLY';
    const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
    const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
    
    let numStr = Math.floor(num).toString();
    let result = '';
    
    if (numStr.length > 7) {
      let crores = parseInt(numStr.slice(0, -7));
      if (crores > 0) result += (ones[crores] || crores) + ' CRORE ';
      numStr = numStr.slice(-7);
    }
    if (numStr.length > 5) {
      let lakhs = parseInt(numStr.slice(0, -5));
      if (lakhs > 0) result += (ones[lakhs] || lakhs) + ' LAKH ';
      numStr = numStr.slice(-5);
    }
    if (numStr.length > 3) {
      let thousands = parseInt(numStr.slice(0, -3));
      if (thousands > 0) result += (ones[thousands] || thousands) + ' THOUSAND ';
      numStr = numStr.slice(-3);
    }
    if (numStr.length > 0) {
      let hundreds = parseInt(numStr);
      if (hundreds > 0) {
        let hVal = Math.floor(hundreds / 100);
        let rem = hundreds % 100;
        if (hVal > 0) result += ones[hVal] + ' HUNDRED ';
        if (rem > 0) {
          if (rem < 20) result += ones[rem];
          else {
            result += tens[Math.floor(rem / 10)];
            if (rem % 10 > 0) result += ' ' + ones[rem % 10];
          }
        }
      }
    }
    return result.trim() + ' RUPEES ONLY';
  };

  // Save Purchase Invoice to Server
  const handleSaveInvoice = async () => {
    if (!selectedVendor && !vendorSearch.trim()) {
      alert('Please select or enter a vendor name.');
      return;
    }

    const payload = {
      user_id: String(currentUserId),
      vendor_name: selectedVendor ? selectedVendor.companyname : vendorSearch.trim(),
      vendor_id: selectedVendor ? selectedVendor.id : 0,
      invoice_prefix: invoicePrefix,
      invoice_id: invoiceId,
      invoice_date: invoiceDate,
      due_date: dueDate,
      payment_type: paymentType,
      place_of_supply: placeOfSupply,
      document_note: documentNote,
      subtotal: totals.subtotal.toFixed(2),
      total_taxable: totals.totalTaxable.toFixed(2),
      total_tax: totals.totalTax.toFixed(2),
      grand_total: totals.grandTotal.toFixed(2),
      total_to_qty: totals.totalQty,
      grand_total_words: numberToWords(totals.grandTotal),
      items: items
    };

    setSubmitting(true);
    try {
      const response = await fetch('https://vagdanam.com/gstapi/save_purchase_invoice.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: JSON.stringify(payload) }).toString()
      });
      const rawText = await response.text();
      const result = JSON.parse(rawText);

      setSubmitting(false);
      if (result.status === 'success') {
        alert(result.message || 'Purchase invoice saved successfully!');
        navigation.goBack();
      } else {
        alert(result.message || 'Failed to save purchase invoice.');
      }
    } catch (err) {
      setSubmitting(false);
      console.error('Save invoice error:', err);
      alert('Network error while saving purchase invoice.');
    }
  };

  const getInitials = () => {
    const name = sessionUser.full_name || sessionUser.username || 'V';
    return name.charAt(0).toUpperCase();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={GREEN} barStyle="light-content" />
      <View style={styles.appContainer}>
        
        {/* ================= TOP BAR ================= */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.menuButton} onPress={() => setMenuOpen(true)}>
            <Ionicons name="menu" size={27} color="#fff" />
          </TouchableOpacity>

          <View style={styles.brandContainer}>
            <MaterialCommunityIcons name="heartbeat" size={22} color="#fff" />
            <View style={{ marginLeft: 6 }}>
              <Text style={styles.brandText} numberOfLines={1}>
                {sessionUser.firm_name || "Vagdanam Bill-Soft"}
              </Text>
              <Text style={styles.brandSubText}>
                ID: {sessionUser.user_code || sessionUser.id || 'N/A'}
              </Text>
            </View>
          </View>

          <View style={styles.topActions}>
            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="notifications-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials()}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.mainContent}>
          <View style={styles.pageHeader}>
            <View style={styles.pageTitleContainer}>
              <FontAwesome5 name="file-invoice" size={18} color="#187A33" style={{ marginRight: 10 }} />
              <Text style={styles.pageTitle}>Create Purchase Invoice</Text>
            </View>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <FontAwesome5 name="arrow-left" size={12} color="#4a4a4a" style={{ marginRight: 6 }} />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          </View>

          {/* Vendor Information Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Vendor Information</Text>
            
            <Text style={styles.inputLabel}>Vendor Name *</Text>
            <TextInput 
              style={styles.modalInput} 
              placeholder="Search vendor by name or phone..." 
              value={vendorSearch}
              onChangeText={searchVendors}
            />
            {showVendorDropdown && vendorList.length > 0 && (
              <View style={styles.dropdownList}>
                {vendorList.map((item) => (
                  <TouchableOpacity 
                    key={item.id} 
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedVendor(item);
                      setVendorSearch(item.companyname);
                      setShowVendorDropdown(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{item.companyname} ({item.contactno1 || 'No Phone'})</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.inputLabel}>Place of Supply</Text>
            <TextInput 
              style={styles.modalInput} 
              placeholder="Enter Place of Supply" 
              value={placeOfSupply}
              onChangeText={setPlaceOfSupply}
            />
          </View>

          {/* Invoice Details Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Invoice Details</Text>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Prefix</Text>
                <TextInput style={styles.modalInput} value={invoicePrefix} onChangeText={setInvoicePrefix} />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={styles.inputLabel}>Invoice No *</Text>
                <TextInput style={styles.modalInput} value={invoiceId} onChangeText={setInvoiceId} />
              </View>
            </View>

            <Text style={styles.inputLabel}>Invoice Date (YYYY-MM-DD)</Text>
            <TextInput style={styles.modalInput} value={invoiceDate} onChangeText={setInvoiceDate} />

            <Text style={styles.inputLabel}>Payment Type</Text>
            <View style={styles.typeRow}>
              {['CREDIT', 'CASH', 'CHEQUE', 'ONLINE'].map((t) => (
                <TouchableOpacity 
                  key={t} 
                  style={[styles.typeChip, paymentType === t && styles.typeChipActive]}
                  onPress={() => setPaymentType(t)}
                >
                  <Text style={[styles.typeChipText, paymentType === t && styles.typeChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Product Items Card */}
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={styles.cardTitle}>Product Items</Text>
              <TouchableOpacity style={styles.addItemBtn} onPress={addProductRow}>
                <FontAwesome5 name="plus" size={10} color="#fff" style={{ marginRight: 4 }} />
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>Add Row</Text>
              </TouchableOpacity>
            </View>

            {items.map((row, index) => (
              <View key={row.id} style={styles.productRowCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#187A33' }}>Item #{index + 1}</Text>
                  {items.length > 1 && (
                    <TouchableOpacity onPress={() => removeProductRow(index)}>
                      <FontAwesome5 name="trash" size={13} color="#dc3545" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Product Search Autocomplete */}
                <Text style={styles.inputLabel}>Product Name *</Text>
                <TextInput 
                  style={styles.modalInput} 
                  placeholder="Search product from database..." 
                  value={row.name}
                  onChangeText={(val) => searchProductsForRow(index, val)}
                />
                {showProductDropdown && activeRowIndex === index && productList.length > 0 && (
                  <View style={styles.dropdownList}>
                    {productList.map((prod) => (
                      <TouchableOpacity 
                        key={prod.id} 
                        style={styles.dropdownItem}
                        onPress={() => selectProductForRow(index, prod)}
                      >
                        <Text style={styles.dropdownItemText}>{prod.name} (MRP: ₹{prod.sell_price || prod.price || 0})</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>HSN</Text>
                    <TextInput 
                      style={styles.modalInput} 
                      value={row.hsn_code}
                      onChangeText={(val) => updateItemField(index, 'hsn_code', val)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Batch</Text>
                    <TextInput 
                      style={styles.modalInput} 
                      value={row.batch_no}
                      onChangeText={(val) => updateItemField(index, 'batch_no', val)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>UOM</Text>
                    <TextInput 
                      style={styles.modalInput} 
                      value={row.uom}
                      onChangeText={(val) => updateItemField(index, 'uom', val)}
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Qty</Text>
                    <TextInput 
                      style={styles.modalInput} 
                      keyboardType="numeric"
                      value={row.qty}
                      onChangeText={(val) => updateItemField(index, 'qty', val)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Free Qty</Text>
                    <TextInput 
                      style={styles.modalInput} 
                      keyboardType="numeric"
                      value={row.free_qty}
                      onChangeText={(val) => updateItemField(index, 'free_qty', val)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Price</Text>
                    <TextInput 
                      style={styles.modalInput} 
                      keyboardType="numeric"
                      value={row.price}
                      onChangeText={(val) => updateItemField(index, 'price', val)}
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>MRP</Text>
                    <TextInput 
                      style={styles.modalInput} 
                      keyboardType="numeric"
                      value={row.mrp}
                      onChangeText={(val) => updateItemField(index, 'mrp', val)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Disc %</Text>
                    <TextInput 
                      style={styles.modalInput} 
                      keyboardType="numeric"
                      value={row.disc}
                      onChangeText={(val) => updateItemField(index, 'disc', val)}
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>CGST %</Text>
                    <TextInput 
                      style={styles.modalInput} 
                      keyboardType="numeric"
                      value={row.cgst}
                      onChangeText={(val) => updateItemField(index, 'cgst', val)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>SGST %</Text>
                    <TextInput 
                      style={styles.modalInput} 
                      keyboardType="numeric"
                      value={row.sgst}
                      onChangeText={(val) => updateItemField(index, 'sgst', val)}
                    />
                  </View>
                </View>

                <Text style={{ fontSize: 13, fontWeight: '700', color: '#187A33', textAlign: 'right', marginTop: 8 }}>
                  Line Total: ₹{row.total}
                </Text>
              </View>
            ))}
          </View>

          {/* Grand Total Summary Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Summary & Totals</Text>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total Qty / Free Qty:</Text><Text style={styles.summaryValue}>{totals.totalQty} / {totals.totalFreeQty}</Text></View>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Taxable Subtotal:</Text><Text style={styles.summaryValue}>₹{totals.subtotal.toFixed(2)}</Text></View>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total Tax (GST):</Text><Text style={styles.summaryValue}>₹{totals.totalTax.toFixed(2)}</Text></View>
            <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: '#e9ecef', paddingTop: 8, marginTop: 4 }]}>
              <Text style={[styles.summaryLabel, { fontWeight: '800', fontSize: 15, color: '#187A33' }]}>Grand Total:</Text>
              <Text style={[styles.summaryValue, { fontWeight: '800', fontSize: 16, color: '#187A33' }]}>₹{totals.grandTotal.toFixed(2)}</Text>
            </View>

            <Text style={[styles.inputLabel, { marginTop: 8 }]}>Total in Words:</Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#6c757d', fontStyle: 'italic' }}>{numberToWords(totals.grandTotal)}</Text>

            <Text style={[styles.inputLabel, { marginTop: 12 }]}>Document Remarks / Notes</Text>
            <TextInput 
              style={[styles.modalInput, { height: 60 }]} 
              placeholder="Internal remarks..." 
              multiline={true}
              value={documentNote}
              onChangeText={setDocumentNote}
            />

            <TouchableOpacity style={styles.saveInvoiceBtn} onPress={handleSaveInvoice} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveInvoiceBtnText}>Save Purchase Invoice</Text>}
            </TouchableOpacity>
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>

        {/* ================= HAMBURGER DRAWER MENU ================= */}
        {menuOpen && (
          <View style={styles.menuOverlay}>
            <TouchableOpacity style={styles.overlayBackground} activeOpacity={1} onPress={() => setMenuOpen(false)} />

            <View style={styles.drawer}>
              {/* Drawer Header */}
              <View style={styles.drawerHeader}>
                <View style={styles.drawerBrandIcon}>
                  <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>{getInitials()}</Text>
                </View>
                <View style={styles.drawerBrandTextContainer}>
                  <Text style={styles.drawerTitle} numberOfLines={1}>
                    {sessionUser.firm_name || sessionUser.full_name || "Vagdanam Soft"}
                  </Text>
                  <Text style={styles.drawerSubtitle}>
                    User ID: {sessionUser.user_code || sessionUser.id || 'N/A'} | Role: {sessionUser.role || 'User'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setMenuOpen(false)}>
                  <Ionicons name="close" size={25} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Drawer Scrollable Navigation Links */}
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                
                <MenuItem icon="view-dashboard-outline" title="Dashboard" shortcut="h" onPress={() => goTo("Dashboard")} />
                <MenuDivider />

                <MenuDropdownHeader
                  icon="account-group"
                  title="Customer / Vendor"
                  isOpen={openDropdown === 'customer'}
                  onPress={() => toggleAccordion('customer')}
                />
                {openDropdown === 'customer' && (
                  <View style={styles.dropdownContainer}>
                    <MenuSubItem title="Customer / Vendor" shortcut="c" onPress={() => goTo("CustomerScreen")} />
                    <MenuSubItem title="Customer / Vendor Group" onPress={() => goTo("CustomerGroup")} />
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
                    <MenuSubItem title="Company Name" onPress={() => goTo("CompanyScreen")} />
                    <MenuSubItem title="Category" onPress={() => goTo("CategoryScreen")} />
                    <MenuSubItem title="Products" shortcut="i" onPress={() => goTo("Products")} />
                    <MenuSubItem title="Stock" onPress={() => goTo("Stock")} />
                  </View>
                )}

                <MenuItem icon="file-document-outline" title="Sale Invoice" shortcut="s" onPress={() => goTo("Sales")} />
                <MenuItem icon="file-document-edit-outline" title="Purchase Invoice" shortcut="p" onPress={() => goTo("Purchase")} active />

                <MenuDivider />
                <MenuItem icon="logout" title="Logout" onPress={handleLogout} />
              </ScrollView>
            </View>
          </View>
        )}

        {/* Bottom Navigation Bar */}
        <View style={styles.bottomNavigation}>
          <TouchableOpacity style={styles.bottomItem} onPress={() => goTo('Dashboard')}>
            <Ionicons name="home-outline" size={22} color="#666" />
            <Text style={styles.bottomLabel}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bottomItem} onPress={() => goTo('Products')}>
            <MaterialCommunityIcons name="package-variant-closed" size={22} color="#666" />
            <Text style={styles.bottomLabel}>Product</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bottomItem} onPress={() => goTo('Purchase')}>
            <MaterialCommunityIcons name="cart-arrow-down" size={22} color="#187A33" />
            <Text style={[styles.bottomLabel, { color: '#187A33', fontWeight: 'bold' }]}>Purchase</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bottomItem} onPress={() => goTo('Sales')}>
            <MaterialCommunityIcons name="file-document-outline" size={22} color="#666" />
            <Text style={styles.bottomLabel}>Sales</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

function MenuItem({ icon, title, shortcut, onPress, active = false }) {
  return (
    <TouchableOpacity style={[styles.menuItem, active && styles.menuItemActive]} onPress={onPress} activeOpacity={0.7}>
      <MaterialCommunityIcons name={icon} size={20} color={active ? GREEN : "#555"} />
      <Text style={[styles.menuItemText, active && styles.menuItemTextActive]}>{title}</Text>
      {shortcut && <Text style={styles.shortcutKey}>{shortcut}</Text>}
      <Ionicons name="chevron-forward" size={15} color="#adb5bd" />
    </TouchableOpacity>
  );
}

function MenuDropdownHeader({ icon, title, isOpen, onPress }) {
  return (
    <TouchableOpacity style={styles.menuSection} onPress={onPress} activeOpacity={0.7}>
      <MaterialCommunityIcons name={icon} size={20} color={GREEN} />
      <Text style={styles.menuSectionText}>{title}</Text>
      <Ionicons name={isOpen ? "chevron-down" : "chevron-forward"} size={16} color="#adb5bd" />
    </TouchableOpacity>
  );
}

function MenuSubItem({ title, shortcut, onPress }) {
  return (
    <TouchableOpacity style={styles.menuSubItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.subDot} />
      <Text style={styles.menuSubText}>{title}</Text>
      {shortcut && <Text style={styles.shortcutKey}>{shortcut}</Text>}
    </TouchableOpacity>
  );
}

function MenuDivider() {
  return <View style={styles.menuDivider} />;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: GREEN },
  appContainer: { flex: 1, backgroundColor: '#f4f6f9' },
  topBar: {
    height: 58,
    backgroundColor: GREEN,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0,
  },
  brandContainer: { flex: 1, flexDirection: "row", alignItems: "center" },
  brandText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  brandSubText: { color: "#b7dfbe", fontSize: 10, fontWeight: "500" },
  topActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  avatarText: { color: '#187A33', fontSize: 14, fontWeight: "800" },
  mainContent: { padding: 16 },
  pageHeader: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  pageTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  backBtn: { backgroundColor: '#f1f3f5', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  backBtnText: { color: '#4a4a4a', fontSize: 12, fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#187A33', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f3f5', paddingBottom: 6 },
  inputLabel: { fontSize: 12, fontWeight: '500', color: '#4a4a4a', marginBottom: 4, marginTop: 8 },
  modalInput: { borderWidth: 1, borderColor: '#e9ecef', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, backgroundColor: '#fff' },
  dropdownList: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ced4da', borderRadius: 6, maxHeight: 120, marginTop: 2, marginBottom: 4, elevation: 4 },
  dropdownItem: { paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#f1f3f5' },
  dropdownItemText: { fontSize: 13, color: '#333' },
  typeRow: { flexDirection: 'row', gap: 6, marginVertical: 4 },
  typeChip: { flex: 1, paddingVertical: 6, borderWidth: 1, borderColor: '#dcdcdc', borderRadius: 6, alignItems: 'center' },
  typeChipActive: { backgroundColor: GREEN, borderColor: GREEN },
  typeChipText: { fontSize: 10, color: '#495057' },
  typeChipTextActive: { color: '#fff', fontWeight: '700' },
  addItemBtn: { backgroundColor: GREEN, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  productRowCard: { backgroundColor: '#f8f9fa', padding: 10, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#e9ecef' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { fontSize: 13, color: '#4a4a4a' },
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  saveInvoiceBtn: { backgroundColor: GREEN, marginTop: 16, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  saveInvoiceBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  bottomNavigation: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e9ecef', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', elevation: 10 },
  bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottomLabel: { fontSize: 10, color: '#495057', fontWeight: '600', marginTop: 2 },
  // Hamburger Drawer Styles
  menuOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row", zIndex: 1000 },
  overlayBackground: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  drawer: { position: "absolute", top: 0, left: 0, bottom: 0, width: Math.min(width * 0.84, 330), backgroundColor: "#fff", elevation: 20 },
  drawerHeader: { backgroundColor: GREEN, paddingHorizontal: 16, paddingTop: Platform.OS === "android" ? 20 : 45, paddingBottom: 18, flexDirection: "row", alignItems: "center" },
  drawerBrandIcon: { width: 43, height: 43, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  drawerBrandTextContainer: { flex: 1, marginLeft: 10 },
  drawerTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  drawerSubtitle: { color: "#b7dfbe", fontSize: 10, marginTop: 2 },
  menuItem: { minHeight: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: "#f1f3f5" },
  menuItemActive: { backgroundColor: LIGHT_GREEN, borderLeftWidth: 3, borderLeftColor: GREEN },
  menuItemText: { flex: 1, marginLeft: 13, fontSize: 13, color: "#495057", fontWeight: "500" },
  menuItemTextActive: { color: GREEN, fontWeight: "700" },
  menuSection: { minHeight: 47, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, backgroundColor: "#fafcfb", borderBottomWidth: 1, borderBottomColor: "#f1f3f5" },
  menuSectionText: { flex: 1, marginLeft: 13, fontSize: 13, color: "#343a40", fontWeight: "700" },
  dropdownContainer: { backgroundColor: "#f8f9fa", paddingVertical: 2 },
  menuSubItem: { minHeight: 38, flexDirection: "row", alignItems: "center", paddingLeft: 46, paddingRight: 18 },
  subDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#adb5bd", marginRight: 11 },
  menuSubText: { flex: 1, fontSize: 12, color: "#6c757d" },
  shortcutKey: { fontSize: 10, backgroundColor: "#e9ecef", color: "#495057", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, marginRight: 8, overflow: 'hidden', fontWeight: "600" },
  menuDivider: { height: 1, backgroundColor: "#e9ecef", marginVertical: 6 },
});