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

export default function CreditNoteScreen({ navigation, route }) {
  const [loading, setLoading] = useState(false);
  const [creditNotes, setCreditNotes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Stats State
  const [stats, setStats] = useState({ total: 0, draft: 0, confirmed: 0, cancelled: 0 });
  
  // Hamburger Menu & Session State
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [sessionUser, setSessionUser] = useState(route?.params?.userData || route?.params?.user || { id: 1 });

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

  // API Endpoints matching your backend setup
  const API_URL = 'https://vagdanam.com/gstapi/get_credit_notes.php';
  const DELETE_URL = 'https://vagdanam.com/gstapi/delete_credit_note.php';
  const CONFIRM_URL = 'https://vagdanam.com/gstapi/confirm_credit_note.php';

  const fetchCreditNotes = async () => {
    setLoading(true);
    try {
      const targetUrl = `${API_URL}?user_id=${currentUserId}&search=${encodeURIComponent(searchQuery)}&status=${encodeURIComponent(statusFilter)}`;
      const response = await fetch(targetUrl);
      const rawText = await response.text();
      let result;
      try {
        result = JSON.parse(rawText);
      } catch (e) {
        console.error("JSON Parse error:", rawText);
        setLoading(false);
        return;
      }

      if (result.status === 'success') {
        setCreditNotes(result.data || []);
        if (result.stats) {
          setStats(result.stats);
        }
      }
    } catch (error) {
      console.error('Error fetching credit notes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCreditNotes();
  }, [searchQuery, statusFilter, currentUserId]);

  const handleConfirmCN = (id, cnNo) => {
    Alert.alert(
      "Confirm Credit Note?",
      `This will confirm credit note "${cnNo}" and lock it from further editing.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Confirm", 
          onPress: async () => {
            try {
              const response = await fetch(CONFIRM_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `id=${id}&user_id=${currentUserId}`
              });
              const rawText = await response.text();
              const result = JSON.parse(rawText);
              if (result.status === 'success') {
                alert('Credit note confirmed successfully');
                fetchCreditNotes();
              } else {
                alert(result.message || 'Failed to confirm credit note');
              }
            } catch (err) {
              console.error('Confirm error:', err);
              alert('Network error during confirmation');
            }
          }
        }
      ]
    );
  };

  const handleDeleteCN = (id, cnNo) => {
    Alert.alert(
      "Confirm Deletion",
      `Are you sure you want to delete credit note "${cnNo}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              const response = await fetch(DELETE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `id=${id}&user_id=${currentUserId}`
              });
              const rawText = await response.text();
              const result = JSON.parse(rawText);
              if (result.status === 'success') {
                alert('Credit note deleted successfully');
                fetchCreditNotes();
              } else {
                alert(result.message || 'Failed to delete credit note');
              }
            } catch (err) {
              console.error('Delete error:', err);
              alert('Network error during deletion');
            }
          }
        }
      ]
    );
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
              <FontAwesome5 name="undo-alt" size={18} color="#dc3545" style={{ marginRight: 10 }} />
              <Text style={styles.pageTitle}>Credit Note (Sales Return)</Text>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={() => goTo('CreateCreditNote')}>
              <FontAwesome5 name="plus" size={12} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.addBtnText}>Add Credit Note</Text>
            </TouchableOpacity>
          </View>

          {/* Stats Cards Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total</Text>
              <Text style={styles.statValue}>{stats.total}</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: '#e65100' }]}>
              <Text style={styles.statLabel}>Draft</Text>
              <Text style={styles.statValue}>{stats.draft}</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: '#28a745' }]}>
              <Text style={styles.statLabel}>Confirmed</Text>
              <Text style={styles.statValue}>{stats.confirmed}</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: '#0d47a1' }]}>
              <Text style={styles.statLabel}>Cancelled</Text>
              <Text style={styles.statValue}>{stats.cancelled}</Text>
            </View>
          </View>

          {/* Filter / Search Bar */}
          <View style={styles.filterSection}>
            <TextInput 
              style={styles.filterInput} 
              placeholder="Search by CN number, customer..." 
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Data Listing */}
          <View style={styles.tableContainer}>
            <Text style={styles.tableTitle}>Credit Note List</Text>
            {loading ? (
              <ActivityIndicator size="large" color="#dc3545" style={{ marginVertical: 20 }} />
            ) : creditNotes.length === 0 ? (
              <Text style={styles.noDataText}>No credit notes found.</Text>
            ) : (
              creditNotes.map((item, index) => (
                <View key={item.id || index} style={styles.tableRowCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowCompanyName}>{item.credit_note_no || 'N/A'}</Text>
                    <Text style={styles.rowSubText}>Customer: {item.customer_name || 'Walk-in Customer'}</Text>
                    <Text style={styles.rowSubText}>Date: {item.credit_note_date || item.created_at || 'N/A'}</Text>
                    <Text style={styles.rowAmountText}>Amount: ₹{parseFloat(item.grand_total || 0).toFixed(2)} | Status: {item.status?.toUpperCase()}</Text>
                  </View>
                  
                  <View style={styles.actionButtonsContainer}>
                    {item.status === 'draft' && (
                      <TouchableOpacity style={styles.confirmActionBtn} onPress={() => handleConfirmCN(item.id, item.credit_note_no)}>
                        <FontAwesome5 name="check" size={14} color="#28a745" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.viewActionBtn} onPress={() => alert(`View CN: ${item.credit_note_no}`)}>
                      <FontAwesome5 name="eye" size={14} color="#0d6efd" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteActionBtn} onPress={() => handleDeleteCN(item.id, item.credit_note_no)}>
                      <FontAwesome5 name="trash" size={14} color="#dc3545" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
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
                <MenuItem icon="undo-alt" title="Credit Note" shortcut="u" onPress={() => goTo("CreditNote")} active />
                <MenuItem icon="file-document-edit-outline" title="Purchase Invoice" shortcut="p" onPress={() => goTo("Purchase")} />

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
  addBtn: { backgroundColor: '#dc3545', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 10, borderLeftWidth: 4, borderLeftColor: '#dc3545', elevation: 2 },
  statLabel: { fontSize: 11, color: '#868e96', fontWeight: '500' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginTop: 4 },
  filterSection: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16 },
  filterInput: { borderWidth: 1, borderColor: '#e9ecef', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, backgroundColor: '#fff' },
  tableContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 20 },
  tableTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 10 },
  tableRowCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f3f5' },
  rowCompanyName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  rowSubText: { fontSize: 11, color: '#6c757d', marginTop: 2 },
  rowAmountText: { fontSize: 12, fontWeight: '700', color: '#dc3545', marginTop: 3 },
  actionButtonsContainer: { flexDirection: 'row', gap: 6 },
  confirmActionBtn: { padding: 8, backgroundColor: '#e8f5e9', borderRadius: 6 },
  viewActionBtn: { padding: 8, backgroundColor: '#e7f5ff', borderRadius: 6 },
  deleteActionBtn: { padding: 8, backgroundColor: '#ffebee', borderRadius: 6 },
  noDataText: { textAlign: 'center', color: '#868e96', marginVertical: 20 },
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