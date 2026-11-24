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
  SafeAreaView,
  Alert,
  StatusBar,
  Platform,
  Dimensions,
  LayoutAnimation,
  UIManager,
  Switch,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');
const GREEN = '#187A33';
const LIGHT_GREEN = '#f0f7f0';

const API_URL = 'https://vagdanam.com/Vighna/gstapi/companies_api.php';

const initialFormState = {
  action: 'add',
  user_id: '',
  id: '',
  company_name: '',
  is_active: true,
};

export default function Company({ navigation, route }) {
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [formData, setFormData] = useState(initialFormState);

  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);

  const [sessionUser, setSessionUser] = useState(
    route?.params?.userData || route?.params?.user || null
  );
  const [sessionLoaded, setSessionLoaded] = useState(false);

  /* ---------- SESSION LOADER ---------- */
  useEffect(() => {
    (async () => {
      try {
        let user = route?.params?.userData || route?.params?.user || null;
        if (!user) {
          const stored = await SecureStore.getItemAsync('user_session');
          if (stored) user = JSON.parse(stored);
        }
        if (user && user.id === undefined && user.user_id === undefined) {
          await SecureStore.deleteItemAsync('user_session');
          setSessionUser(null);
          Alert.alert('Session expired', 'Please log in again.', [
            { text: 'OK', onPress: () => navigation?.replace?.('Login') },
          ]);
          return;
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
  const displayName =
    sessionUser?.full_name || sessionUser?.username || sessionUser?.firm_name || 'User';

  const getInitials = () => (displayName.charAt(0) || 'V').toUpperCase();

  /* ---------- FETCH ---------- */
  const fetchCompanies = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const url = `${API_URL}?user_id=${encodeURIComponent(currentUserId)}&search=${encodeURIComponent(searchQuery)}`;
      const res = await fetch(url);
      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); } catch { data = null; }
      if (data?.status === 'success') {
        setCompanies(Array.isArray(data.data) ? data.data : []);
      }
    } catch (e) {
      console.error('fetchCompanies:', e);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, searchQuery]);

  useEffect(() => {
    if (!sessionLoaded || !currentUserId) return;
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoaded, currentUserId]);

  // Debounced search
  useEffect(() => {
    if (!sessionLoaded || !currentUserId) return;
    const t = setTimeout(fetchCompanies, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, sessionLoaded, currentUserId]);

  /* ---------- HANDLERS ---------- */
  const handleOpenAdd = () => {
    setFormData({ ...initialFormState, user_id: String(currentUserId) });
    setModalVisible(true);
  };

  const handleEdit = (item) => {
    setFormData({
      action: 'edit',
      user_id: String(currentUserId),
      id: String(item.id),
      company_name: item.company_name || '',
      is_active: item.is_active == 1,
    });
    setModalVisible(true);
  };

  const handleView = (item) => {
    setSelectedCompany(item);
    setViewModalVisible(true);
  };

  const handleOpenDelete = (item) => {
    setSelectedCompany(item);
    setDeleteModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.company_name.trim()) {
      Alert.alert('Validation', 'Company Name is required.');
      return;
    }
    if (!currentUserId) {
      Alert.alert('Error', 'Session not loaded. Please log in again.');
      return;
    }

    const payload = {
      action: formData.action,
      user_id: String(currentUserId),
      id: formData.id || '',
      company_name: formData.company_name.trim(),
      is_active: formData.is_active ? '1' : '0',
    };

    const body = Object.entries(payload)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v ?? '')}`)
      .join('&');

    try {
      setLoading(true);
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const raw = await res.text();
      let result;
      try { result = JSON.parse(raw); } catch { result = null; }

      if (result?.status === 'success') {
        Alert.alert('Success', result.message || 'Saved successfully');
        setModalVisible(false);
        setFormData({ ...initialFormState, user_id: String(currentUserId) });
        fetchCompanies();
      } else {
        Alert.alert('Error', result?.message || 'Save failed');
      }
    } catch (e) {
      Alert.alert('Network error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCompany) return;
    try {
      setLoading(true);
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `action=delete&id=${encodeURIComponent(selectedCompany.id)}&user_id=${encodeURIComponent(currentUserId)}`,
      });
      const raw = await res.text();
      let result;
      try { result = JSON.parse(raw); } catch { result = null; }

      if (result?.status === 'success') {
        Alert.alert('Deleted', result.message || 'Deleted successfully');
        setDeleteModalVisible(false);
        setSelectedCompany(null);
        fetchCompanies();
      } else {
        Alert.alert('Error', result?.message || 'Delete failed');
      }
    } catch (e) {
      Alert.alert('Network error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const goTo = (screen, params = {}) => {
    setMenuOpen(false);
    navigation?.navigate?.(screen, { userData: sessionUser, ...params });
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await SecureStore.deleteItemAsync('user_session');
    } catch (e) {}
    navigation?.replace?.('Login');
  };

  const toggleAccordion = (name) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenDropdown(openDropdown === name ? null : name);
  };

  /* ---------- UI ---------- */
  return (
    <SafeAreaView style={styles.safeArea}>
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
            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="notifications-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials()}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.mainContent} keyboardShouldPersistTaps="handled">
          {/* PAGE HEADER */}
          <View style={styles.pageHeader}>
            <View style={styles.pageTitleContainer}>
              <FontAwesome5 name="building" size={18} color={GREEN} style={{ marginRight: 10 }} />
              <Text style={styles.pageTitle}>Company List</Text>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd}>
              <FontAwesome5 name="plus" size={12} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.addBtnText}>Add Company</Text>
            </TouchableOpacity>
          </View>

          {/* SEARCH */}
          <View style={styles.filterSection}>
            <TextInput
              style={styles.filterInput}
              placeholder="Search company name..."
              placeholderTextColor="#adb5bd"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* LIST */}
          <View style={styles.tableContainer}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableTitle}>
                <FontAwesome5 name="list" size={12} color={GREEN} />  Company List
              </Text>
              <Text style={styles.tableCount}>
                Total: <Text style={{ fontWeight: '700' }}>{companies.length}</Text>
              </Text>
            </View>

            {loading ? (
              <ActivityIndicator size="large" color={GREEN} style={{ marginVertical: 20 }} />
            ) : companies.length === 0 ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <FontAwesome5 name="building" size={32} color="#adb5bd" />
                <Text style={styles.noDataText}>
                  No companies found. Tap "Add Company" to create one.
                </Text>
              </View>
            ) : (
              companies.map((item, idx) => (
                <View key={String(item.id || idx)} style={styles.rowCard}>
                  <Text style={styles.serialNum}>{idx + 1}</Text>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.rowTitle}>{item.company_name}</Text>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: item.is_active == 1 ? '#e8f5e9' : '#ffebee' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          { color: item.is_active == 1 ? '#2e7d32' : '#c62828' },
                        ]}
                      >
                        {item.is_active == 1 ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.actions} onStartShouldSetResponder={() => true}>
                    <TouchableOpacity
                      style={[styles.iconBtn, { backgroundColor: '#e3f2fd' }]}
                      onPress={() => handleView(item)}
                    >
                      <FontAwesome5 name="eye" size={12} color="#0d6efd" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.iconBtn, { backgroundColor: '#e8f5e9' }]}
                      onPress={() => handleEdit(item)}
                    >
                      <FontAwesome5 name="edit" size={12} color={GREEN} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.iconBtn, { backgroundColor: '#ffebee' }]}
                      onPress={() => handleOpenDelete(item)}
                    >
                      <FontAwesome5 name="trash" size={12} color="#dc3545" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
          <View style={{ height: 80 }} />
        </ScrollView>

        {/* ADD/EDIT MODAL */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {formData.action === 'edit' ? 'Edit Company' : 'Add Company'}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                <Text style={styles.inputLabel}>
                  Company Name <Text style={{ color: '#dc3545' }}>*</Text>
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter company name"
                  placeholderTextColor="#adb5bd"
                  maxLength={255}
                  value={formData.company_name}
                  onChangeText={(val) => setFormData({ ...formData, company_name: val })}
                />

                <View style={styles.switchRow}>
                  <Text style={styles.inputLabel}>Active Status</Text>
                  <Switch
                    value={formData.is_active}
                    onValueChange={(v) => setFormData({ ...formData, is_active: v })}
                    trackColor={{ false: '#ccc', true: GREEN }}
                  />
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalCloseText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSave} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalSaveText}>
                      {formData.action === 'edit' ? 'Update' : 'Save'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* VIEW MODAL */}
        <Modal
          visible={viewModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setViewModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Company Details</Text>
                <TouchableOpacity onPress={() => setViewModalVisible(false)}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {selectedCompany && (
                  <>
                    <DetailRow label="ID" value={selectedCompany.id} />
                    <DetailRow label="Company Name" value={selectedCompany.company_name} />
                    <DetailRow
                      label="Status"
                      value={selectedCompany.is_active == 1 ? 'Active' : 'Inactive'}
                    />
                    <DetailRow label="Created" value={selectedCompany.created_at || 'N/A'} />
                  </>
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setViewModalVisible(false)}
                >
                  <Text style={styles.modalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* DELETE MODAL */}
        <Modal
          visible={deleteModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setDeleteModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={[styles.modalHeader, { backgroundColor: '#dc3545' }]}>
                <Text style={styles.modalTitle}>Confirm Delete</Text>
                <TouchableOpacity onPress={() => setDeleteModalVisible(false)}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                <Text style={{ fontSize: 15, color: '#4a4a4a', marginBottom: 12 }}>
                  Delete the company:
                </Text>
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#1a1a1a' }}>
                  {selectedCompany?.company_name}
                </Text>
                <Text style={{ color: '#dc3545', marginTop: 12 }}>
                  This action cannot be undone!
                </Text>
              </View>
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setDeleteModalVisible(false)}
                >
                  <Text style={styles.modalCloseText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveBtn, { backgroundColor: '#dc3545' }]}
                  onPress={handleDelete}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalSaveText}>Delete</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* HAMBURGER DRAWER */}
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

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
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
                    <MenuSubItem title="Customer / Vendor Group" onPress={() => goTo('CustomerGroup')} />
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
                    <MenuSubItem title="Stock" onPress={() => goTo('Stock')} />
                  </View>
                )}

                <MenuItem icon="file-document-outline" title="Sale Invoice" onPress={() => goTo('Sales')} />
                <MenuItem icon="file-document-edit-outline" title="Purchase Invoice" onPress={() => goTo('Purchase')} />

                <MenuDropdownHeader
                  icon="cash-multiple"
                  title="Payment"
                  isOpen={openDropdown === 'payment'}
                  onPress={() => toggleAccordion('payment')}
                />
                {openDropdown === 'payment' && (
                  <View style={styles.dropdownContainer}>
                    <MenuSubItem title="Inward Payment (Sales)" onPress={() => goTo('Payment', { type: 'inward' })} />
                    <MenuSubItem title="Outward Payment (Purchase)" onPress={() => goTo('Payment', { type: 'outward' })} />
                  </View>
                )}

                <MenuDivider />
                <MenuItem icon="logout" title="Logout" onPress={handleLogout} />
              </ScrollView>
            </View>
          </View>
        )}

        {/* ===== BOTTOM NAVIGATION ===== */}
        <View style={styles.bottomNavigation}>
          <TouchableOpacity style={styles.bottomItem} onPress={() => goTo('Dashboard')}>
            <Ionicons name="home-outline" size={22} color="#666" />
            <Text style={styles.bottomLabel}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomItem} onPress={() => goTo('CustomerScreen')}>
            <Ionicons name="people-outline" size={22} color="#666" />
            <Text style={styles.bottomLabel}>Customer</Text>
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

/* ---------------- SUB-COMPONENTS ---------------- */
function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}:</Text>
      <Text style={styles.detailValue}>{String(value ?? '-')}</Text>
    </View>
  );
}

function MenuItem({ icon, title, onPress, active = false }) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, active && styles.menuItemActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
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

  topBar: {
    height: 58, backgroundColor: GREEN, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  menuButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  brandContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 5 },
  brandText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  brandSubText: { color: '#b7dfbe', fontSize: 10, fontWeight: '500' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  avatar: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: GREEN, fontSize: 14, fontWeight: '800' },

  mainContent: { padding: 16 },

  pageHeader: {
    backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  pageTitleContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  pageTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  addBtn: {
    backgroundColor: GREEN, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  filterSection: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16 },
  filterInput: {
    borderWidth: 1, borderColor: '#e9ecef', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 13,
    backgroundColor: '#fff', color: '#1a1a1a',
  },

  tableContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 20 },
  tableHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  tableTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  tableCount: { fontSize: 12, color: '#868e96' },
  noDataText: { textAlign: 'center', color: '#868e96', fontSize: 13, marginTop: 10 },

  rowCard: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f3f5',
  },
  serialNum: { fontSize: 13, color: '#868e96', width: 24, textAlign: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignSelf: 'flex-start', marginTop: 4 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 6 },
  iconBtn: { padding: 8, borderRadius: 6 },

  bottomNavigation: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e9ecef',
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', elevation: 10,
  },
  bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottomLabel: { fontSize: 10, color: '#495057', fontWeight: '600', marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, maxHeight: '85%', overflow: 'hidden' },
  modalHeader: {
    backgroundColor: GREEN, padding: 16, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
  },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalBody: { padding: 16 },
  modalFooter: {
    padding: 16, borderTopWidth: 1, borderTopColor: '#e9ecef',
    flexDirection: 'row', justifyContent: 'flex-end', gap: 10,
  },
  modalCloseBtn: {
    paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#f8f9fa',
    borderRadius: 6, borderWidth: 1, borderColor: '#e9ecef',
  },
  modalCloseText: { fontSize: 13, color: '#4a4a4a' },
  modalSaveBtn: { paddingHorizontal: 22, paddingVertical: 8, backgroundColor: GREEN, borderRadius: 6 },
  modalSaveText: { fontSize: 13, color: '#fff', fontWeight: '600' },

  inputLabel: { fontSize: 12, fontWeight: '600', color: '#4a4a4a', marginBottom: 4, marginTop: 8 },
  modalInput: {
    borderWidth: 1, borderColor: '#e9ecef', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 10, fontSize: 14,
    backgroundColor: '#fff', color: '#1a1a1a',
  },
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 16, padding: 10, backgroundColor: '#f8f9fa', borderRadius: 8,
  },
  detailRow: {
    flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f3f5',
  },
  detailLabel: { width: 130, fontSize: 13, fontWeight: '600', color: '#495057' },
  detailValue: { flex: 1, fontSize: 13, color: '#212529' },

  menuOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row', zIndex: 1000,
  },
  overlayBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  drawer: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: Math.min(width * 0.84, 330), backgroundColor: '#fff', elevation: 20,
  },
  drawerHeader: {
    backgroundColor: GREEN, paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 20 : 45, paddingBottom: 18,
    flexDirection: 'row', alignItems: 'center',
  },
  drawerBrandIcon: {
    width: 43, height: 43, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  drawerBrandTextContainer: { flex: 1, marginLeft: 10 },
  drawerTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  drawerSubtitle: { color: '#b7dfbe', fontSize: 10, marginTop: 2 },

  menuItem: {
    minHeight: 48, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#f1f3f5',
  },
  menuItemActive: { backgroundColor: LIGHT_GREEN, borderLeftWidth: 3, borderLeftColor: GREEN },
  menuItemText: { flex: 1, marginLeft: 13, fontSize: 13, color: '#495057', fontWeight: '500' },
  menuItemTextActive: { color: GREEN, fontWeight: '700' },

  menuSection: {
    minHeight: 47, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, backgroundColor: '#fafcfb',
    borderBottomWidth: 1, borderBottomColor: '#f1f3f5',
  },
  menuSectionText: { flex: 1, marginLeft: 13, fontSize: 13, color: '#343a40', fontWeight: '700' },
  dropdownContainer: { backgroundColor: '#f8f9fa', paddingVertical: 2 },
  menuSubItem: {
    minHeight: 38, flexDirection: 'row', alignItems: 'center',
    paddingLeft: 46, paddingRight: 18,
  },
  subDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#adb5bd', marginRight: 11 },
  menuSubText: { flex: 1, fontSize: 12, color: '#6c757d' },
  menuDivider: { height: 1, backgroundColor: '#e9ecef', marginVertical: 6 },
});