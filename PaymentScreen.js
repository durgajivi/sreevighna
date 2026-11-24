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

try {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
} catch (e) {}

const { width } = Dimensions.get('window');
const GREEN = '#187A33';
const LIGHT_GREEN = '#f0f7f0';

const API_URL = 'https://vagdanam.com/Vighna/gstapi/payment_api.php';
const WEB_BASE = 'https://vagdanam.com/Vighna/gstapi';

export default function PaymentScreen({ navigation, route }) {
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('inward');

  const [deleteVisible, setDeleteVisible] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);

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

  /* ---------- Fetch payments ---------- */
  const fetchPayments = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      let url =
        API_URL +
        '?action=list&type=' +
        encodeURIComponent(activeTab) +
        '&user_id=' +
        encodeURIComponent(currentUserId);
      if (searchQuery) url += '&search=' + encodeURIComponent(searchQuery);

      const res = await fetch(url);
      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); } catch { data = null; }

      if (data && data.status === 'success') {
        setPayments(Array.isArray(data.data) ? data.data : []);
      } else {
        setPayments([]);
      }
    } catch (e) {
      console.error('fetchPayments:', e);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, activeTab, searchQuery]);

  useEffect(() => {
    if (!sessionLoaded || !currentUserId) return;
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoaded, currentUserId, activeTab]);

  useEffect(() => {
    if (!sessionLoaded || !currentUserId) return;
    const t = setTimeout(fetchPayments, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  /* ---------- Helpers ---------- */
  const formatDate = (s) => {
    if (!s) return '-';
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  const getPaymentBadge = (type) => {
    const map = {
      cash:                     { bg: '#28a745', fg: '#fff', text: 'CASH' },
      cheque:                   { bg: '#17a2b8', fg: '#fff', text: 'CHEQUE' },
      online_transfer:          { bg: '#007bff', fg: '#fff', text: 'ONLINE' },
      bank_transfer:            { bg: '#6f42c1', fg: '#fff', text: 'BANK' },
      tds:                      { bg: '#fd7e14', fg: '#fff', text: 'TDS' },
      'cash-bad-debts-kasar':   { bg: '#6c757d', fg: '#fff', text: 'BAD DEBTS' },
    };
    return map[type] || { bg: '#adb5bd', fg: '#fff', text: (type || '').toUpperCase() };
  };

  /* ---------- Handlers ---------- */
  const openDelete = (p) => {
    setSelectedPayment(p);
    setDeleteVisible(true);
  };

  const handleDelete = async () => {
    if (!selectedPayment) return;
    try {
      setLoading(true);
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:
          'action=delete&id=' +
          encodeURIComponent(selectedPayment.id) +
          '&user_id=' +
          encodeURIComponent(currentUserId),
      });
      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); } catch { data = null; }
      if (data && data.status === 'success') {
        Alert.alert('Deleted', data.message || 'Payment deleted');
        setDeleteVisible(false);
        setSelectedPayment(null);
        fetchPayments();
      } else {
        Alert.alert('Error', (data && data.message) || 'Delete failed');
      }
    } catch (e) {
      Alert.alert('Network error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const viewPayment = (p) => {
    navigation?.navigate?.('PaymentViewScreen', {
      userData: sessionUser,
      paymentId: p.id,
      payment: p,
      type: activeTab,
    });
  };

  const editPayment = (p) => {
    navigation?.navigate?.('CreatePayment', {
      userData: sessionUser,
      paymentId: p.id,
      mode: 'edit',
      type: activeTab,
    });
  };

  const printPayment = (p) => {
    const url =
      WEB_BASE +
      '/view_payment_receipt.php?id=' +
      p.id +
      '&type=' +
      encodeURIComponent(activeTab) +
      '&print=1';
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not print'));
  };

  const createNewPayment = () => {
    navigation?.navigate?.('CreatePayment', {
      userData: sessionUser,
      mode: 'create',
      type: activeTab,
    });
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
    try { await SecureStore.deleteItemAsync('user_session'); } catch (e) {}
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
                name="money-check-alt"
                size={16}
                color={GREEN}
                style={{ marginRight: 10 }}
              />
              <Text style={styles.pageTitle}>
                {activeTab === 'inward' ? 'Inward Payment' : 'Outward Payment'}
              </Text>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={createNewPayment}>
              <FontAwesome5 name="plus" size={12} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.addBtnText}>New Payment</Text>
            </TouchableOpacity>
          </View>

          {/* TAB SWITCHER */}
          <View style={styles.tabSection}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'inward' && styles.tabActive]}
              onPress={() => setActiveTab('inward')}
            >
              <Ionicons
                name="arrow-down-circle"
                size={14}
                color={activeTab === 'inward' ? '#fff' : '#28a745'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'inward' && styles.tabTextActive,
                ]}
              >
                Inward
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'outward' && styles.tabActiveWarning]}
              onPress={() => setActiveTab('outward')}
            >
              <Ionicons
                name="arrow-up-circle"
                size={14}
                color={activeTab === 'outward' ? '#fff' : '#ffc107'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'outward' && styles.tabTextActive,
                ]}
              >
                Outward
              </Text>
            </TouchableOpacity>
          </View>

          {/* SEARCH */}
          <View style={styles.filterSection}>
            <TextInput
              style={styles.filterInput}
              placeholder="Search receipts..."
              placeholderTextColor="#adb5bd"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* LIST */}
          <View style={styles.tableContainer}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableTitle}>
                <FontAwesome5 name="list" size={12} color={GREEN} />  Payment List
              </Text>
              <Text style={styles.tableCount}>
                Total: <Text style={{ fontWeight: '700' }}>{payments.length}</Text>
              </Text>
            </View>

            {loading ? (
              <ActivityIndicator size="large" color={GREEN} style={{ marginVertical: 20 }} />
            ) : payments.length === 0 ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <FontAwesome5 name="inbox" size={32} color="#adb5bd" />
                <Text style={styles.noDataText}>
                  No payment records found.
                </Text>
              </View>
            ) : (
              payments.map((item, idx) => {
                const badge = getPaymentBadge(item.payment_type);
                const outstanding = parseFloat(item.outstanding || 0);
                return (
                  <View key={String(item.id || idx)} style={styles.rowCard}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.rowTopLine}>
                        <Text style={styles.rowReceiptNo}>
                          {item.receipt_no || 'N/A'}
                        </Text>
                        <Text style={styles.rowDate}>
                          {formatDate(item.payment_date)}
                        </Text>
                      </View>
                      <Text style={styles.rowCompany}>
                        <FontAwesome5 name="building" size={10} color="#6c757d" />{' '}
                        {item.company_name || 'Unknown'}
                      </Text>
                      {item.invoice_no ? (
                        <Text style={styles.rowInvoice}>
                          Invoice: {item.invoice_no}
                        </Text>
                      ) : null}
                      <View style={styles.rowBadges}>
                        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.badgeText, { color: badge.fg }]}>
                            {badge.text}
                          </Text>
                        </View>
                        {outstanding > 0.01 ? (
                          <View style={[styles.badge, { backgroundColor: '#ffebee' }]}>
                            <Text style={[styles.badgeText, { color: '#dc3545' }]}>
                              Outstanding ₹{outstanding.toFixed(2)}
                            </Text>
                          </View>
                        ) : (
                          <View style={[styles.badge, { backgroundColor: '#e8f5e9' }]}>
                            <Text style={[styles.badgeText, { color: '#2e7d32' }]}>
                              PAID
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.rowAmount}>
                        ₹{' '}
                        {Number(item.amount || 0).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </Text>
                    </View>

                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={[styles.iconBtn, { backgroundColor: '#e8f5e9' }]}
                        onPress={() => viewPayment(item)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <FontAwesome5 name="eye" size={12} color={GREEN} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.iconBtn, { backgroundColor: '#e3f2fd' }]}
                        onPress={() => editPayment(item)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <FontAwesome5 name="edit" size={12} color="#0d6efd" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.iconBtn, { backgroundColor: '#e0f7fa' }]}
                        onPress={() => printPayment(item)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <FontAwesome5 name="print" size={12} color="#17a2b8" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.iconBtn, { backgroundColor: '#ffebee' }]}
                        onPress={() => openDelete(item)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <FontAwesome5 name="trash" size={12} color="#dc3545" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
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
                <Text style={{ fontSize: 15, color: '#4a4a4a' }}>Delete payment:</Text>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: '700',
                    color: '#1a1a1a',
                    marginTop: 8,
                  }}
                >
                  {selectedPayment?.receipt_no}
                </Text>
                <Text style={{ color: '#dc3545', marginTop: 12 }}>
                  This action cannot be undone!
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
                    <MenuSubItem title="Company Name" onPress={() => goTo('CompanyScreen')} />
                    <MenuSubItem title="Category" onPress={() => goTo('CategoryScreen')} />
                    <MenuSubItem title="Products" onPress={() => goTo('Products')} />
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
                <MenuItem
                  icon="cash-multiple"
                  title="Payment"
                  onPress={() => goTo('Payment')}
                  active
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
          <TouchableOpacity style={styles.bottomItem} onPress={() => goTo('CategoryScreen')}>
            <MaterialCommunityIcons name="shape-outline" size={22} color="#666" />
            <Text style={styles.bottomLabel}>Category</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomItem} onPress={() => goTo('Purchase')}>
            <MaterialCommunityIcons name="cart-arrow-down" size={22} color="#666" />
            <Text style={styles.bottomLabel}>Purchase</Text>
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
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: GREEN, fontSize: 14, fontWeight: '800' },

  mainContent: { padding: 14 },
  pageHeader: {
    backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  pageTitleContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  pageTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  addBtn: {
    backgroundColor: GREEN, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  tabSection: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12,
    padding: 6, marginBottom: 12, gap: 6,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 8,
    backgroundColor: '#f4f6f9',
  },
  tabActive: { backgroundColor: '#28a745' },
  tabActiveWarning: { backgroundColor: '#ffc107' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#4a4a4a' },
  tabTextActive: { color: '#fff' },

  filterSection: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12,
  },
  filterInput: {
    borderWidth: 1, borderColor: '#e9ecef', borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13,
    backgroundColor: '#fff', color: '#1a1a1a',
  },

  tableContainer: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16,
  },
  tableHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  tableTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  tableCount: { fontSize: 12, color: '#868e96' },
  noDataText: { textAlign: 'center', color: '#868e96', fontSize: 13, marginTop: 10 },

  rowCard: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f3f5',
  },
  rowTopLine: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  rowReceiptNo: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  rowDate: { fontSize: 11, color: '#6c757d' },
  rowCompany: { fontSize: 12, color: '#495057', marginTop: 3 },
  rowInvoice: { fontSize: 11, color: '#868e96', marginTop: 2 },
  rowBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  rowAmount: { fontSize: 15, fontWeight: '700', color: GREEN, marginTop: 4 },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginLeft: 6, maxWidth: 90, justifyContent: 'flex-end' },
  iconBtn: { padding: 7, borderRadius: 6 },

  bottomNavigation: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e9ecef',
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', elevation: 10,
  },
  bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottomLabel: { fontSize: 10, color: '#495057', fontWeight: '600', marginTop: 2 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 14,
  },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, maxHeight: '90%', overflow: 'hidden' },
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

  menuOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row', zIndex: 1000,
  },
  overlayBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  drawer: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: Math.min(width * 0.84, 330), backgroundColor: '#fff', elevation: 20,
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