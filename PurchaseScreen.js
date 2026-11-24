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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

// Enable LayoutAnimation on Android (safe no-op on iOS)
try {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
} catch (e) {
  // ignore
}

const { width } = Dimensions.get('window');
const GREEN = '#187A33';
const LIGHT_GREEN = '#f0f7f0';

const API_URL = 'https://vagdanam.com/Vighna/gstapi/purchase_api.php';
const WEB_BASE = 'https://vagdanam.com/Vighna/gstapi';

export default function PurchaseScreen({ navigation, route }) {
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [deleteVisible, setDeleteVisible] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);

  const [sessionUser, setSessionUser] = useState(
    route?.params?.userData || route?.params?.user || null
  );
  const [sessionLoaded, setSessionLoaded] = useState(false);

  /* ---------- Session ---------- */
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

  /* ---------- Fetch invoices ---------- */
  const fetchInvoices = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const url =
        API_URL +
        '?action=list&user_id=' +
        encodeURIComponent(currentUserId) +
        '&search=' +
        encodeURIComponent(searchQuery);
      const res = await fetch(url);
      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }
      if (data && data.status === 'success') {
        setInvoices(Array.isArray(data.data) ? data.data : []);
      }
    } catch (e) {
      console.error('fetchInvoices:', e);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, searchQuery]);

  useEffect(() => {
    if (!sessionLoaded || !currentUserId) return;
    fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoaded, currentUserId]);

  useEffect(() => {
    if (!sessionLoaded || !currentUserId) return;
    const t = setTimeout(fetchInvoices, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, sessionLoaded, currentUserId]);

  /* ---------- Handlers ---------- */

  // VIEW → navigate to PurchaseViewScreen (falls back to browser)
  const openPreview = (invoice) => {
    if (!invoice || !invoice.id) {
      Alert.alert('Error', 'Invalid invoice');
      return;
    }

    if (navigation && navigation.navigate) {
      try {
        navigation.navigate('PurchaseViewScreen', {
          userData: sessionUser,
          invoiceId: invoice.id,
          invoice: invoice,
        });
        return;
      } catch (e) {
        console.warn('PurchaseViewScreen not registered, falling back to browser');
      }
    }

    const url = `${WEB_BASE}/view_purchase_invoice.php?id=${invoice.id}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'Could not open invoice')
    );
  };

  const openDelete = (invoice) => {
    setSelectedInvoice(invoice);
    setDeleteVisible(true);
  };

  const handleDelete = async () => {
    if (!selectedInvoice) return;
    try {
      setLoading(true);
      const res = await fetch(
        API_URL +
          '?action=delete&id=' +
          encodeURIComponent(selectedInvoice.id) +
          '&user_id=' +
          encodeURIComponent(currentUserId),
        { method: 'POST' }
      );
      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }
      if (data && data.status === 'success') {
        Alert.alert('Deleted', data.message || 'Invoice deleted');
        setDeleteVisible(false);
        setSelectedInvoice(null);
        fetchInvoices();
      } else {
        Alert.alert('Error', (data && data.message) || 'Delete failed');
      }
    } catch (e) {
      Alert.alert('Network error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const openInBrowser = (invoice, params = '') => {
    if (!invoice || !invoice.id) return;
    const url = WEB_BASE + '/view_purchase_invoice.php?id=' + invoice.id + params;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open link'));
  };

  const printInvoice = (invoice) => openInBrowser(invoice, '&print=1');

  const createNewInvoice = () => {
    navigation?.navigate?.('PurchaseOrderScreen', { userData: sessionUser });
  };

  /* ---------- Navigation ---------- */
  const goTo = (screen, params = {}) => {
    setMenuOpen(false);
    if (navigation && navigation.navigate) {
      navigation.navigate(screen, { userData: sessionUser, ...params });
    }
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await SecureStore.deleteItemAsync('user_session');
    } catch (e) {}
    if (navigation && navigation.replace) navigation.replace('Login');
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
            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="notifications-outline" size={22} color="#fff" />
            </TouchableOpacity>
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
            <View style={styles.pageTitleContainer}>
              <FontAwesome5
                name="file-invoice"
                size={18}
                color={GREEN}
                style={{ marginRight: 10 }}
              />
              <Text style={styles.pageTitle}>Purchase Invoice</Text>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={createNewInvoice}>
              <FontAwesome5 name="plus" size={12} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.addBtnText}>New Invoice</Text>
            </TouchableOpacity>
          </View>

          {/* SEARCH */}
          <View style={styles.filterSection}>
            <TextInput
              style={styles.filterInput}
              placeholder="Search invoices..."
              placeholderTextColor="#adb5bd"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* LIST */}
          <View style={styles.tableContainer}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableTitle}>
                <FontAwesome5 name="list" size={12} color={GREEN} />  Purchase Invoice List
              </Text>
              <Text style={styles.tableCount}>
                Total: <Text style={{ fontWeight: '700' }}>{invoices.length}</Text>
              </Text>
            </View>

            {loading ? (
              <ActivityIndicator size="large" color={GREEN} style={{ marginVertical: 20 }} />
            ) : invoices.length === 0 ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <FontAwesome5 name="inbox" size={32} color="#adb5bd" />
                <Text style={styles.noDataText}>
                  No purchase invoices found. Tap "New Invoice" to start.
                </Text>
              </View>
            ) : (
              invoices.map((item, idx) => (
                <View key={String(item.id || idx)} style={styles.rowCard}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowTopLine}>
                      <Text style={styles.rowInvoiceNo}>{item.invoice_no || 'N/A'}</Text>
                      <Text style={styles.rowDate}>
                        {item.invoice_date
                          ? new Date(item.invoice_date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '-'}
                      </Text>
                    </View>
                    <Text style={styles.rowVendor}>
                      <FontAwesome5 name="user" size={10} color="#6c757d" />{' '}
                      {item.vendor_name || 'Walk-in Vendor'}
                    </Text>
                    <Text style={styles.rowAmount}>
                      Rs{' '}
                      {Number(item.grand_total || 0).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </Text>
                  </View>

                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.iconBtn, { backgroundColor: '#e3f2fd' }]}
                      onPress={() => openPreview(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <FontAwesome5 name="eye" size={12} color="#0d6efd" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.iconBtn, { backgroundColor: '#fff8e1' }]}
                      onPress={() => printInvoice(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <FontAwesome5 name="print" size={12} color="#e6a700" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.iconBtn, { backgroundColor: '#ffebee' }]}
                      onPress={() => openDelete(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <FontAwesome5 name="trash" size={12} color="#dc3545" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
          <View style={{ height: 90 }} />
        </ScrollView>

        {/* ================= DELETE MODAL ================= */}
        <Modal
          visible={deleteVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setDeleteVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={[styles.modalHeader, { backgroundColor: '#dc3545' }]}>
                <Text style={styles.modalTitle}>Confirm Delete</Text>
                <TouchableOpacity onPress={() => setDeleteVisible(false)}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                <Text style={{ fontSize: 15, color: '#4a4a4a' }}>Delete invoice:</Text>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: '700',
                    color: '#1a1a1a',
                    marginTop: 8,
                  }}
                >
                  {selectedInvoice?.invoice_no}
                </Text>
                <Text style={{ color: '#dc3545', marginTop: 12 }}>
                  This will delete all line items. Cannot be undone!
                </Text>
              </View>
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setDeleteVisible(false)}
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

        {/* ================= DRAWER ================= */}
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
                <MenuItem
                  icon="view-dashboard-outline"
                  title="Dashboard"
                  onPress={() => goTo('Dashboard')}
                />
                <MenuDivider />

                <MenuDropdownHeader
                  icon="account-group"
                  title="Customer / Vendor"
                  isOpen={openDropdown === 'customer'}
                  onPress={() => toggleAccordion('customer')}
                />
                {openDropdown === 'customer' && (
                  <View style={styles.dropdownContainer}>
                    <MenuSubItem
                      title="Customer / Vendor"
                      onPress={() => goTo('CustomerScreen')}
                    />
                    <MenuSubItem
                      title="Customer / Vendor Group"
                      onPress={() => goTo('CustomerGroup')}
                    />
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

                <MenuItem
                  icon="file-document-outline"
                  title="Sale Invoice"
                  onPress={() => goTo('Sales')}
                />
                <MenuItem
                  icon="file-document-edit-outline"
                  title="Purchase Invoice"
                  onPress={() => goTo('Purchase')}
                />

                <MenuDivider />
                <MenuItem icon="logout" title="Logout" onPress={handleLogout} />
              </ScrollView>
            </View>
          </View>
        )}

        {/* ================= BOTTOM NAV ================= */}
        <View style={styles.bottomNavigation}>
          <TouchableOpacity style={styles.bottomItem} onPress={() => goTo('Dashboard')}>
            <Ionicons name="home-outline" size={22} color="#666" />
            <Text style={styles.bottomLabel}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bottomItem}
            onPress={() => goTo('CustomerScreen')}
          >
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

/* ---------------- SUB-COMPONENTS ---------------- */
function MenuItem({ icon, title, onPress, active = false }) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, active && styles.menuItemActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons name={icon} size={20} color={active ? GREEN : '#555'} />
      <Text style={[styles.menuItemText, active && styles.menuItemTextActive]}>
        {title}
      </Text>
      <Ionicons name="chevron-forward" size={15} color="#adb5bd" />
    </TouchableOpacity>
  );
}

function MenuDropdownHeader({ icon, title, isOpen, onPress }) {
  return (
    <TouchableOpacity style={styles.menuSection} onPress={onPress} activeOpacity={0.7}>
      <MaterialCommunityIcons name={icon} size={20} color={GREEN} />
      <Text style={styles.menuSectionText}>{title}</Text>
      <Ionicons
        name={isOpen ? 'chevron-down' : 'chevron-forward'}
        size={16}
        color="#adb5bd"
      />
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
  iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: GREEN, fontSize: 14, fontWeight: '800' },

  mainContent: { padding: 14 },
  pageHeader: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageTitleContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  pageTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  addBtn: {
    backgroundColor: GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  filterSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  filterInput: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    backgroundColor: '#fff',
    color: '#1a1a1a',
  },

  tableContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tableTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  tableCount: { fontSize: 12, color: '#868e96' },
  noDataText: { textAlign: 'center', color: '#868e96', fontSize: 13, marginTop: 10 },

  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
  },
  rowTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowInvoiceNo: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  rowDate: { fontSize: 11, color: '#6c757d' },
  rowVendor: { fontSize: 12, color: '#495057', marginTop: 3 },
  rowAmount: { fontSize: 15, fontWeight: '700', color: GREEN, marginTop: 4 },

  actions: { flexDirection: 'row', gap: 6, marginLeft: 8 },
  iconBtn: { padding: 8, borderRadius: 6 },

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
    maxHeight: '90%',
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
  modalBody: { padding: 16 },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCloseBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  modalCloseText: { fontSize: 13, color: '#4a4a4a' },
  modalSaveBtn: {
    paddingHorizontal: 22,
    paddingVertical: 8,
    backgroundColor: GREEN,
    borderRadius: 6,
  },
  modalSaveText: { fontSize: 13, color: '#fff', fontWeight: '600' },

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
  menuItemActive: {
    backgroundColor: LIGHT_GREEN,
    borderLeftWidth: 3,
    borderLeftColor: GREEN,
  },
  menuItemText: {
    flex: 1,
    marginLeft: 13,
    fontSize: 13,
    color: '#495057',
    fontWeight: '500',
  },
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
  menuSectionText: {
    flex: 1,
    marginLeft: 13,
    fontSize: 13,
    color: '#343a40',
    fontWeight: '700',
  },
  dropdownContainer: { backgroundColor: '#f8f9fa', paddingVertical: 2 },
  menuSubItem: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 46,
    paddingRight: 18,
  },
  subDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#adb5bd',
    marginRight: 11,
  },
  menuSubText: { flex: 1, fontSize: 12, color: '#6c757d' },
  menuDivider: { height: 1, backgroundColor: '#e9ecef', marginVertical: 6 },
});