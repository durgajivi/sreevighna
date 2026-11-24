import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  Dimensions,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Switch
} from "react-native";
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";

const { width } = Dimensions.get("window");
const GREEN = "#187A33";
const LIGHT_GREEN = "#f0f7f0";

export default function CreateSaleScreen({ navigation, route }) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Session State
  const [sessionUser, setSessionUser] = useState(route?.params?.userData || route?.params?.user || { id: 1 });
  const invoiceType = route?.params?.invoiceType || 'wholesale';
  const isRetail = invoiceType === 'retail';

  // Customer State
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerList, setCustomerList] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerGst, setCustomerGst] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('Andhra Pradesh');

  // Invoice Header Fields
  const [invoicePrefix, setInvoicePrefix] = useState(isRetail ? 'RTL' : 'INV');
  const [invoiceId, setInvoiceId] = useState('2026-0001');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 15*24*60*60*1000).toISOString().split('T')[0]);
  const [paymentType, setPaymentType] = useState('CREDIT');
  const [roundOffEnabled, setRoundOffEnabled] = useState(true);
  const [documentNote, setDocumentNote] = useState('');

  // Product Items Rows State
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
      stock: 0,
      total: '0.00' 
    }
  ]);

  // Product Autocomplete Modal per row state
  const [activeRowIndex, setActiveRowIndex] = useState(null);
  const [productList, setProductList] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Price History Modal State
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [priceHistoryData, setPriceHistoryData] = useState([]);
  const [historyProductTitle, setHistoryProductTitle] = useState('');

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

  // Search Customers from Database filtered by user_id
  const searchCustomers = async (term) => {
    setCustomerSearch(term);
    if (!term || term.length < 2) {
      setCustomerList([]);
      setShowCustomerDropdown(false);
      return;
    }
    try {
      const response = await fetch(`https://vagdanam.com/gstapi/get_companies1.php?user_id=${currentUserId}&search=${encodeURIComponent(term)}`);
      const text = await response.text();
      const result = JSON.parse(text);
      if (result.status === 'success') {
        setCustomerList(result.data || []);
        setShowCustomerDropdown(true);
      }
    } catch (err) {
      console.error('Customer search error:', err);
    }
  };

  const selectCustomer = (cust) => {
    setSelectedCustomer(cust);
    setCustomerSearch(cust.companyname);
    setCustomerPhone(cust.contactno1 || '');
    setCustomerGst(cust.gstno || '');
    setPlaceOfSupply(cust.state || 'Andhra Pradesh');
    
    let fullAddr = [cust.address1, cust.address2, cust.city, cust.state, cust.pincode].filter(Boolean).join(', ');
    setCustomerAddress(fullAddr);
    setShowCustomerDropdown(false);
  };

  // Search Products for a specific item row
  const searchProductsForRow = async (index, term) => {
    setActiveRowIndex(index);
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
    updated[index].stock = parseFloat(product.stock || 0);

    const mrpVal = parseFloat(product.sell_price || product.price || 0);
    updated[index].mrp = mrpVal.toFixed(2);

    let priceVal = mrpVal;
    if (isRetail) {
      priceVal = mrpVal; // Retail calculation rule can be adjusted as needed
    }
    updated[index].price = priceVal.toFixed(2);

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
    let taxAmount = isRetail ? 0 : (taxable * gstRate) / 100;
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
      stock: 0,
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
    let taxAmount = isRetail ? 0 : (taxable * (cgst + sgst)) / 100;
    updated[index].total = (taxable + taxAmount).toFixed(2);

    setItems(updated);
  };

  // Fetch Customer Price History
  const fetchPriceHistory = async (productId, productName) => {
    if (!selectedCustomer) {
      alert('Please select a customer first to view price history.');
      return;
    }
    setHistoryProductTitle(productName);
    setHistoryModalVisible(true);
    setHistoryLoading(true);

    try {
      const response = await fetch(`https://vagdanam.com/gstapi/get_customer_prices.php?customer_id=${selectedCustomer.id}&product_id=${productId}&user_id=${currentUserId}`);
      const text = await response.text();
      const result = JSON.parse(text);
      if (result.status === 'success') {
        setPriceHistoryData(result.data || []);
      } else {
        setPriceHistoryData([]);
      }
    } catch (err) {
      console.error('Price history error:', err);
      setPriceHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Calculate Grand Totals
  const calculateTotals = () => {
    let subtotal = 0;
    let totalTaxable = 0;
    let totalTax = 0;
    let totalQty = 0;

    items.forEach(item => {
      const qty = parseFloat(item.qty) || 0;
      const price = parseFloat(item.price) || 0;
      const disc = parseFloat(item.disc) || 0;
      const cgst = parseFloat(item.cgst) || 0;
      const sgst = parseFloat(item.sgst) || 0;

      const rowSub = qty * price;
      const discAmount = (rowSub * disc) / 100;
      const taxable = rowSub - discAmount;
      const tax = isRetail ? 0 : (taxable * (cgst + sgst)) / 100;

      subtotal += rowSub;
      totalTaxable += taxable;
      totalTax += tax;
      totalQty += qty;
    });

    const rawGrand = totalTaxable + totalTax;
    const roundOff = roundOffEnabled ? (Math.round(rawGrand) - rawGrand) : 0;
    const grandTotal = roundOffEnabled ? Math.round(rawGrand) : rawGrand;

    return { subtotal, totalTaxable, totalTax, roundOff, grandTotal, totalQty };
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

  // Save Sales Invoice to Server
  const handleSaveInvoice = async () => {
    if (!selectedCustomer && !customerSearch.trim()) {
      alert('Please select or enter a customer name.');
      return;
    }

    const payload = {
      user_id: String(currentUserId),
      invoice_type: invoiceType,
      customer_name: selectedCustomer ? selectedCustomer.companyname : customerSearch.trim(),
      customer_id: selectedCustomer ? selectedCustomer.id : 0,
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
      round_off: totals.roundOff.toFixed(2),
      grand_total: totals.grandTotal.toFixed(2),
      total_quantity: totals.totalQty,
      grand_total_words: numberToWords(totals.grandTotal),
      items: items
    };

    setSubmitting(true);
    try {
      const response = await fetch('https://vagdanam.com/gstapi/save_sale_invoice.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: JSON.stringify(payload) }).toString()
      });
      const rawText = await response.text();
      const result = JSON.parse(rawText);

      setSubmitting(false);
      if (result.status === 'success') {
        alert(result.message || 'Sales invoice saved successfully!');
        navigation.goBack();
      } else {
        alert(result.message || 'Failed to save sales invoice.');
      }
    } catch (err) {
      setSubmitting(false);
      console.error('Save invoice error:', err);
      alert('Network error while saving sales invoice.');
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
          <TouchableOpacity style={styles.menuButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.brandContainer}>
            <MaterialCommunityIcons name="heartbeat" size={22} color="#fff" />
            <View style={{ marginLeft: 6 }}>
              <Text style={styles.brandText} numberOfLines={1}>
                {sessionUser.firm_name || "Vagdanam Bill-Soft"}
              </Text>
              <Text style={styles.brandSubText}>
                {isRetail ? 'Retail Sale' : 'Wholesale Sale'}
              </Text>
            </View>
          </View>

          <View style={styles.topActions}>
            <TouchableOpacity style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials()}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.mainContent}>
          <View style={styles.pageHeader}>
            <View style={styles.pageTitleContainer}>
              <FontAwesome5 name="file-invoice" size={18} color="#187A33" style={{ marginRight: 10 }} />
              <Text style={styles.pageTitle}>Create {isRetail ? 'Retail' : 'Wholesale'} Invoice</Text>
            </View>
          </View>

          {/* Customer Information Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Customer Information</Text>
            
            <Text style={styles.inputLabel}>Customer Name *</Text>
            <TextInput 
              style={styles.modalInput} 
              placeholder="Search customer by name or phone..." 
              value={customerSearch}
              onChangeText={searchCustomers}
            />
            {showCustomerDropdown && customerList.length > 0 && (
              <View style={styles.dropdownList}>
                {customerList.map((item) => (
                  <TouchableOpacity 
                    key={item.id} 
                    style={styles.dropdownItem}
                    onPress={() => selectCustomer(item)}
                  >
                    <Text style={styles.dropdownItemText}>{item.companyname} ({item.contactno1 || 'No Phone'})</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.inputLabel}>Address</Text>
            <TextInput 
              style={[styles.modalInput, {height: 50}]} 
              multiline={true}
              value={customerAddress}
              onChangeText={setCustomerAddress}
            />

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Phone No</Text>
                <TextInput style={styles.modalInput} value={customerPhone} onChangeText={setCustomerPhone} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>GSTIN / PAN</Text>
                <TextInput style={styles.modalInput} value={customerGst} onChangeText={setCustomerGst} />
              </View>
            </View>

            <Text style={styles.inputLabel}>Place of Supply</Text>
            <TextInput style={styles.modalInput} value={placeOfSupply} onChangeText={setPlaceOfSupply} />
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
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    {row.product_id ? (
                      <TouchableOpacity onPress={() => fetchPriceHistory(row.product_id, row.name)}>
                        <FontAwesome5 name="history" size={13} color="#0d47a1" />
                      </TouchableOpacity>
                    ) : null}
                    {items.length > 1 && (
                      <TouchableOpacity onPress={() => removeProductRow(index)}>
                        <FontAwesome5 name="trash" size={13} color="#dc3545" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Product Search Autocomplete */}
                <Text style={styles.inputLabel}>Product Name * (Stock: {row.stock})</Text>
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
                        <Text style={styles.dropdownItemText}>{prod.name} (Stock: {prod.stock} | MRP: ₹{prod.sell_price || prod.price || 0})</Text>
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

                {!isRetail && (
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
                )}

                <Text style={{ fontSize: 13, fontWeight: '700', color: '#187A33', textAlign: 'right', marginTop: 8 }}>
                  Line Total: ₹{row.total}
                </Text>
              </View>
            ))}
          </View>

          {/* Grand Total Summary Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Summary & Totals</Text>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total Qty:</Text><Text style={styles.summaryValue}>{totals.totalQty}</Text></View>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Taxable Subtotal:</Text><Text style={styles.summaryValue}>₹{totals.subtotal.toFixed(2)}</Text></View>
            {!isRetail && <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total Tax (GST):</Text><Text style={styles.summaryValue}>₹{totals.totalTax.toFixed(2)}</Text></View>}
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 }}>
              <Text style={styles.summaryLabel}>Round Off</Text>
              <Switch value={roundOffEnabled} onValueChange={setRoundOffEnabled} trackColor={{ false: "#767577", true: "#c8e6c9" }} thumbColor={roundOffEnabled ? GREEN : "#f4f3f4"} />
            </View>

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
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveInvoiceBtnText}>Save Sales Invoice</Text>}
            </TouchableOpacity>
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>

        {/* ================= PRICE HISTORY MODAL ================= */}
        <Modal visible={historyModalVisible} transparent={true} animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '80%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Price History - {historyProductTitle}</Text>
                <TouchableOpacity onPress={() => setHistoryModalVisible(false)}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ padding: 16 }}>
                {historyLoading ? (
                  <ActivityIndicator size="large" color={GREEN} style={{ marginVertical: 20 }} />
                ) : priceHistoryData.length === 0 ? (
                  <Text style={{ textAlign: 'center', color: '#868e96', marginVertical: 20 }}>No previous sales history for this customer on this item.</Text>
                ) : (
                  priceHistoryData.map((histGroup, hIdx) => (
                    <View key={hIdx} style={{ marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f1f3f5', paddingBottom: 10 }}>
                      <Text style={{ fontWeight: '700', fontSize: 13, color: '#1a1a1a' }}>{histGroup.product_name} ({histGroup.sku})</Text>
                      {histGroup.invoices?.map((inv, iIdx) => (
                        <View key={iIdx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, backgroundColor: '#f8f9fa', padding: 6, borderRadius: 6 }}>
                          <Text style={{ fontSize: 12, color: '#4a4a4a' }}>Inv: {inv.invoice_no} ({inv.date})</Text>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: GREEN }}>₹{parseFloat(inv.price).toFixed(2)} (Qty: {inv.quantity})</Text>
                        </View>
                      ))}
                    </View>
                  ))
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setHistoryModalVisible(false)}>
                  <Text style={styles.modalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </View>
    </SafeAreaView>
  );
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
  menuButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  brandContainer: { flex: 1, flexDirection: "row", alignItems: "center", marginLeft: 5 },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  modalHeader: { backgroundColor: GREEN, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalFooter: { padding: 12, borderTopWidth: 1, borderTopColor: '#e9ecef', flexDirection: 'row', justifyContent: 'flex-end' },
  modalCloseBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#f1f3f5', borderRadius: 6 },
  modalCloseText: { fontSize: 13, color: '#4a4a4a', fontWeight: '600' },
});