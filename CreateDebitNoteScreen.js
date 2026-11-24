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
import * as SecureStore from 'expo-secure-store';

// Enable LayoutAnimation for Android smooth drawer toggling
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get("window");
const GREEN = "#187A33";
const LIGHT_GREEN = "#f0f7f0";

export default function CreateDebitNoteScreen({ navigation, route }) {
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

  // DN Header Fields
  const [dnPrefix, setDnPrefix] = useState('DN');
  const [dnNo, setDnNo] = useState('2026-0001');
  const [dnDate, setDnDate] = useState(new Date().toISOString().split('T')[0]);
  const [dnType, setDnType] = useState('goods_return');
  const [dnStatus, setDnStatus] = useState('draft');
  const [vendorGst, setVendorGst] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('Andhra Pradesh');
  const [documentNote, setDocumentNote] = useState('');

  // Product Items Rows State
  const [items, setItems] = useState([
    { id: 1, name: '', hsn: '', batch: '', qty: '1', price: '0.00', mrp: '0.00', disc: '0', cgst: '0', sgst: '0', uom: 'Pcs', total: '0.00' }
  ]);

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

  // Search Vendors from Database
  const searchVendors = async (term) => {
    setVendorSearch(term);
    if (!term || term.length < 2) {
      setVendorList([]);
      setShowVendorDropdown(false);
      return;
    }
    try {
      const response = await fetch(`https://vagdanam.com/gstapi/get_companies.php?user_id=${currentUserId}&search=${encodeURIComponent(term)}&type=Vendor`);
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

  // Add Product Item Row
  const addProductRow = () => {
    setItems([...items, { id: items.length + 1, name: '', hsn: '', batch: '', qty: '1', price: '0.00', mrp: '0.00', disc: '0', cgst: '0', sgst: '0', uom: 'Pcs', total: '0.00' }]);
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
    let totalTax = 0;
    let totalQty = 0;

    items.forEach(item => {
      const qty = parseFloat(item.qty) || 0;
      const price = parseFloat(item.price) || 0;
      const disc = parseFloat(item.disc) || 0;
      const cgst = parseFloat(item.cgst) || 0;
      const sgst = parseFloat(item.sgst) || 0;

      const rowSub = (qty * price) - ((qty * price * disc) / 100);
      subtotal += rowSub;
      totalTax += (rowSub * (cgst + sgst)) / 100;
      totalQty += qty;
    });

    const grandTotal = Math.round(subtotal + totalTax);
    return { subtotal, totalTax, grandTotal, totalQty };
  };

  const totals = calculateTotals();

  // Save Debit Note to Server
  const handleSaveDN = async () => {
    if (!selectedVendor && !vendorSearch.trim()) {
      alert('Please select or enter a vendor name.');
      return;
    }

    const payload = {
      user_id: String(currentUserId),
      vendor_name: selectedVendor ? selectedVendor.companyname : vendorSearch.trim(),
      vendor_id: selectedVendor ? selectedVendor.id : 0,
      vendor_gst: vendorGst,
      vendor_phone: vendorPhone,
      vendor_address: vendorAddress,
      debit_note_prefix: dnPrefix,
      debit_note_no: dnNo,
      debit_note_date: dnDate,
      debit_note_type: dnType,
      status: dnStatus,
      place_of_supply: placeOfSupply,
      document_note: documentNote,
      subtotal: totals.subtotal.toFixed(2),
      total_tax: totals.totalTax.toFixed(2),
      grand_total: totals.grandTotal.toFixed(2),
      items: items
    };

    setSubmitting(true);
    try {
      const response = await fetch('https://vagdanam.com/gstapi/save_debit_note.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: JSON.stringify(payload) }).toString()
      });
      const rawText = await response.text();
      const result = JSON.parse(rawText);



      

      setSubmitting(false);
      if (result.status === 'success') {
        alert(result.message || 'Debit note saved successfully!');
        navigation.goBack();
      } else {
        alert(result.message || 'Failed to save debit note.');
      }
    } catch (err) {
      setSubmitting(false);
      console.error('Save DN error:', err);
      alert('Network error while saving debit note.');
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
              <FontAwesome5 name="arrow-right" size={18} color="#dc3545" style={{ marginRight: 10 }} />
              <Text style={styles.pageTitle}>Create Debit Note</Text>
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
                      setVendorGst(item.gstno || '');
                      setVendorPhone(item.contactno1 || '');
                      setVendorAddress([item.address1, item.city, item.state].filter(Boolean).join(', '));
                      setPlaceOfSupply(item.state || 'Andhra Pradesh');
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

          {/* DN Details Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Debit Note Details</Text>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Prefix</Text>
                <TextInput style={styles.modalInput} value={dnPrefix} onChangeText={setDnPrefix} />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={styles.inputLabel}>DN No *</Text>
                <TextInput style={styles.modalInput} value={dnNo} onChangeText={setDnNo} />
              </View>
            </View>

            <Text style={styles.inputLabel}>DN Date (YYYY-MM-DD)</Text>
            <TextInput style={styles.modalInput} value={dnDate} onChangeText={setDnDate} />

            <Text style={styles.inputLabel}>Debit Note Type</Text>
            <View style={styles.typeRow}>
              {['goods_return', 'discount_after_purchase', 'correction'].map((t) => (
                <TouchableOpacity 
                  key={t} 
                  style={[styles.typeChip, dnType === t && styles.typeChipActive]}
                  onPress={() => setDnType(t)}
                >
                  <Text style={[styles.typeChipText, dnType === t && styles.typeChipTextActive]}>{t.replace('_', ' ').toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Status</Text>
            <View style={styles.typeRow}>
              {['draft', 'confirmed', 'cancelled'].map((s) => (
                <TouchableOpacity 
                  key={s} 
                  style={[styles.typeChip, dnStatus === s && styles.typeChipActive]}
                  onPress={() => setDnStatus(s)}
                >
                  <Text style={[styles.typeChipText, dnStatus === s && styles.typeChipTextActive]}>{s.toUpperCase()}</Text>
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
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#dc3545' }}>Item #{index + 1}</Text>
                  {items.length > 1 && (
                    <TouchableOpacity onPress={() => removeProductRow(index)}>
                      <FontAwesome5 name="trash" size={13} color="#dc3545" />
                    </TouchableOpacity>
                  )}
                </View>

                <TextInput 
                  style={[styles.modalInput, { marginTop: 6 }]} 
                  placeholder="Product Name" 
                  value={row.name}
                  onChangeText={(val) => updateItemField(index, 'name', val)}
                />

                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                  <TextInput 
                    style={[styles.modalInput, { flex: 1 }]} 
                    placeholder="Qty" 
                    keyboardType="numeric"
                    value={row.qty}
                    onChangeText={(val) => updateItemField(index, 'qty', val)}
                  />
                  <TextInput 
                    style={[styles.modalInput, { flex: 1 }]} 
                    placeholder="Price" 
                    keyboardType="numeric"
                    value={row.price}
                    onChangeText={(val) => updateItemField(index, 'price', val)}
                  />
                  <TextInput 
                    style={[styles.modalInput, { flex: 1 }]} 
                    placeholder="Disc %" 
                    keyboardType="numeric"
                    value={row.disc}
                    onChangeText={(val) => updateItemField(index, 'disc', val)}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                  <TextInput 
                    style={[styles.modalInput, { flex: 1 }]} 
                    placeholder="CGST %" 
                    keyboardType="numeric"
                    value={row.cgst}
                    onChangeText={(val) => updateItemField(index, 'cgst', val)}
                  />
                  <TextInput 
                    style={[styles.modalInput, { flex: 1 }]} 
                    placeholder="SGST %" 
                    keyboardType="numeric"
                    value={row.sgst}
                    onChangeText={(val) => updateItemField(index, 'sgst', val)}
                  />
                </View>

                <Text style={{ fontSize: 12, fontWeight: '700', color: '#333', textAlign: 'right', marginTop: 6 }}>
                  Total: ₹{row.total}
                </Text>
              </View>
            ))}
          </View>

          {/* Grand Total Summary Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Summary & Totals</Text>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total Qty:</Text><Text style={styles.summaryValue}>{totals.totalQty}</Text></View>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Taxable Subtotal:</Text><Text style={styles.summaryValue}>₹{totals.subtotal.toFixed(2)}</Text></View>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total Tax:</Text><Text style={styles.summaryValue}>₹{totals.totalTax.toFixed(2)}</Text></View>
            <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: '#e9ecef', paddingTop: 8, marginTop: 4 }]}>
              <Text style={[styles.summaryLabel, { fontWeight: '800', fontSize: 15, color: '#dc3545' }]}>Grand Total:</Text>
              <Text style={[styles.summaryValue, { fontWeight: '800', fontSize: 16, color: '#dc3545' }]}>₹{totals.grandTotal.toFixed(2)}</Text>
            </View>

            <Text style={[styles.inputLabel, { marginTop: 12 }]}>Document Remarks / Notes</Text>
            <TextInput 
              style={[styles.modalInput, { height: 60 }]} 
              placeholder="Internal remarks..." 
              multiline={true}
              value={documentNote}
              onChangeText={setDocumentNote}
            />

            <TouchableOpacity style={styles.saveDNBtn} onPress={handleSaveDN} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveDNBtnText}>Save Debit Note</Text>}
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
                <MenuItem icon="file-document-edit-outline" title="Purchase Invoice" shortcut="p" onPress={() => goTo("Purchase")} />
                <MenuItem icon="arrow-right" title="Purchase Return (Debit Note)" shortcut="d" onPress={() => goTo("DebitNote")} active />

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
            <MaterialCommunityIcons name="cart-arrow-down" size={22} color="#666" />
            <Text style={styles.bottomLabel}>Purchase</Text>
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
  menuButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
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
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#dc3545', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f3f5', paddingBottom: 6 },
  inputLabel: { fontSize: 12, fontWeight: '500', color: '#4a4a4a', marginBottom: 4, marginTop: 8 },
  modalInput: { borderWidth: 1, borderColor: '#e9ecef', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, backgroundColor: '#fff' },
  dropdownList: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ced4da', borderRadius: 6, maxHeight: 120, marginTop: 2, marginBottom: 4, elevation: 4 },
  dropdownItem: { paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#f1f3f5' },
  dropdownItemText: { fontSize: 13, color: '#333' },
  typeRow: { flexDirection: 'row', gap: 6, marginVertical: 4 },
  typeChip: { flex: 1, paddingVertical: 6, borderWidth: 1, borderColor: '#dcdcdc', borderRadius: 6, alignItems: 'center' },
  typeChipActive: { backgroundColor: '#dc3545', borderColor: '#dc3545' },
  typeChipText: { fontSize: 10, color: '#495057' },
  typeChipTextActive: { color: '#fff', fontWeight: '700' },
  addItemBtn: { backgroundColor: '#dc3545', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  productRowCard: { backgroundColor: '#f8f9fa', padding: 10, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#e9ecef' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { fontSize: 13, color: '#4a4a4a' },
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  saveDNBtn: { backgroundColor: '#dc3545', marginTop: 16, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  saveDNBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
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