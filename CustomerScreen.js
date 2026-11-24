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
  Platform,
  Dimensions,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');
const GREEN = '#187A33';
const LIGHT_GREEN = '#f0f7f0';

const API_URL = 'https://vagdanam.com/Vighna/gstapi/get_companies.php';
const STATS_URL = 'https://vagdanam.com/Vighna/gstapi/get_company_stats.php';
const SAVE_URL = 'https://vagdanam.com/Vighna/gstapi/save_company.php';
const DELETE_URL = 'https://vagdanam.com/Vighna/gstapi/delete_company.php';

const initialFormState = {
  action: 'insert',
  user_id: '',
  company_id: '0',
  companytype: 'Customer',
  gstno: '',
  companyname: '',
  contactperson: '',
  contactno1: '',
  email: '',
  registration_type: 'Unregistered',
  pan: '',
  dl_no: '',
  address1: '',
  address2: '',
  landmark: '',
  city: '',
  country: 'India',
  state: '',
  pincode: '',
  balance_amount: '',
  balance_type: 'Credit',
  balance_amount_vendor: '',
  balance_type_vendor: 'Credit',
  website: '',
  amount_limit: '',
  note: '',
  is_active: '1',
};

export default function CustomerScreen({ navigation, route }) {
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [stats, setStats] = useState({ total: 0, customers: 0, vendors: 0, both: 0 });
  const [searchQuery, setSearchQuery] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);

  const [sessionUser, setSessionUser] = useState(
    route?.params?.userData || route?.params?.user || null
  );
  const [sessionLoaded, setSessionLoaded] = useState(false);

  const [formData, setFormData] = useState(initialFormState);

  /* ---------------------------------------------------------------------- */
  /*  SESSION LOADER — runs once                                            */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    (async () => {
      try {
        let user = route?.params?.userData || route?.params?.user || null;

        if (!user) {
          const stored = await SecureStore.getItemAsync('user_session');
          if (stored) user = JSON.parse(stored);
        }

        if (user && user.id === undefined && user.user_id === undefined) {
          console.warn('⚠ Session has no numeric id — clearing, forcing login.');
          await SecureStore.deleteItemAsync('user_session');
          setSessionUser(null);
          Alert.alert(
            'Session expired',
            'Please log in again to continue.',
            [{ text: 'OK', onPress: () => navigation?.replace?.('Login') }]
          );
          return;
        }

        setSessionUser(user);
        console.log('✅ sessionUser loaded:', JSON.stringify(user));
      } catch (e) {
        console.error('Session load failed:', e);
      } finally {
        setSessionLoaded(true);
      }
    })();
  }, []);

  /* ---------------------------------------------------------------------- */
  /*  USER IDENTITY — computed, NOT state                                   */
  /* ---------------------------------------------------------------------- */
  const currentUserId = sessionUser?.id ?? sessionUser?.user_id ?? null;

  const displayName =
    sessionUser?.full_name ||
    sessionUser?.username ||
    sessionUser?.firm_name ||
    'User';

  useEffect(() => {
    if (sessionLoaded) {
      console.log('=== CustomerScreen ===');
      console.log('displayName →', displayName);
      console.log('currentUserId →', currentUserId);
    }
  }, [sessionLoaded, currentUserId, displayName]);

  /* ---------------------------------------------------------------------- */
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

  /* ---------------------------------------------------------------------- */
  /*  FETCH LIST                                                            */
  /* ---------------------------------------------------------------------- */
  const fetchCompanies = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const targetUrl = `${API_URL}?user_id=${encodeURIComponent(
        currentUserId
      )}&search=${encodeURIComponent(searchQuery)}`;
      console.log('GET companies:', targetUrl);

      const response = await fetch(targetUrl);
      const rawText = await response.text();
      console.log('RAW:', rawText.slice(0, 300));

      let result;
      try {
        result = JSON.parse(rawText);
      } catch (e) {
        console.error('JSON Parse error:', rawText);
        return;
      }

      if (result.status === 'success') {
        setCompanies(Array.isArray(result.data) ? result.data : []);
      } else if (result.status === 'error') {
        console.warn('API error:', result.message);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, searchQuery]);

  /* ---------------------------------------------------------------------- */
  /*  FETCH STATS                                                           */
  /* ---------------------------------------------------------------------- */
  const fetchStats = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const url = `${STATS_URL}?user_id=${encodeURIComponent(currentUserId)}`;
      const res = await fetch(url);
      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); } catch { data = null; }

      if (data?.status === 'success') {
        setStats({
          total: Number(data.total) || 0,
          customers: Number(data.customers) || 0,
          vendors: Number(data.vendors) || 0,
          both: Number(data.both) || 0,
        });
      } else {
        console.warn('Stats endpoint returned non-success:', data);
      }
    } catch (e) {
      console.warn('Stats fetch failed:', e?.message);
    }
  }, [currentUserId]);

  /* ---------------------------------------------------------------------- */
  /*  INITIAL LOAD                                                          */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (!sessionLoaded || !currentUserId) return;
    fetchCompanies();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoaded, currentUserId]);

  /* ---------------------------------------------------------------------- */
  /*  DEBOUNCED SEARCH RELOAD                                               */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (!sessionLoaded || !currentUserId) return;
    const t = setTimeout(fetchCompanies, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, sessionLoaded, currentUserId]);

  /* ---------------------------------------------------------------------- */
  /*  HANDLERS                                                              */
  /* ---------------------------------------------------------------------- */
  const handleOpenAddModal = () => {
    setFormData({ ...initialFormState, user_id: String(currentUserId) });
    setModalVisible(true);
  };

  const handleViewCompany = (item) => {
    setSelectedCompany(item);
    setViewModalVisible(true);
  };

  const handleEditCompany = (item) => {
    setFormData({
      action: 'update',
      user_id: String(currentUserId),
      company_id: String(item.id),
      companytype: item.company_type || 'Customer',
      gstno: item.gstno || '',
      companyname: item.companyname || '',
      contactperson: item.contactperson || '',
      contactno1: item.contactno1 || '',
      email: item.email || '',
      registration_type: item.registration_type || 'Unregistered',
      pan: item.pan || '',
      dl_no: item.dl_no || '',
      address1: item.address1 || '',
      address2: item.address2 || '',
      landmark: item.landmark || '',
      city: item.city || '',
      country: item.country || 'India',
      state: item.state || '',
      pincode: item.pincode || '',
      balance_amount: item.balance_amount ? String(item.balance_amount) : '',
      balance_type: item.balance_type || 'Credit',
      balance_amount_vendor: item.balance_amount_vendor
        ? String(item.balance_amount_vendor)
        : '',
      balance_type_vendor: item.balance_type_vendor || 'Credit',
      website: item.website || '',
      amount_limit: item.amount_limit ? String(item.amount_limit) : '',
      note: item.note || '',
      is_active:
        item.is_active === 1 || item.is_active === '1' || item.is_active === true
          ? '1'
          : '0',
    });
    setModalVisible(true);
  };

  const handleDeleteCompany = (id, name) => {
    Alert.alert('Confirm Deletion', `Delete "${name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await fetch(DELETE_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: `id=${encodeURIComponent(id)}&user_id=${encodeURIComponent(
                currentUserId
              )}`,
            });
            const raw = await res.text();
            console.log('DELETE raw:', raw.slice(0, 200));
            const result = JSON.parse(raw);
            if (result.status === 'success') {
              Alert.alert('Deleted', result.message || 'Deleted successfully');
              fetchCompanies();
              fetchStats();
            } else {
              Alert.alert('Error', result.message || 'Delete failed');
            }
          } catch (err) {
            Alert.alert('Network error', err.message);
          }
        },
      },
    ]);
  };

  const handleSaveCustomer = async () => {
    if (!formData.companyname.trim() || !formData.city.trim() || !formData.state.trim()) {
      Alert.alert('Validation', 'Fill required fields (Company Name, City, State)');
      return;
    }
    if (!currentUserId) {
      Alert.alert('Error', 'Session not loaded. Please log in again.');
      return;
    }

    const payload = {
      ...formData,
      user_id: String(currentUserId),
      company_type: formData.companytype,
      is_active: formData.is_active === '1' ? '1' : '0',
    };

    const body = Object.entries(payload)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v ?? '')}`)
      .join('&');

    console.log('SAVE POST body:', body.slice(0, 500));

    try {
      setLoading(true);
      const res = await fetch(SAVE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const raw = await res.text();
      console.log('SAVE raw:', raw.slice(0, 300));

      let result;
      try { result = JSON.parse(raw); }
      catch {
        Alert.alert('Server error', 'Invalid response format');
        return;
      }

      if (result.status === 'success') {
        Alert.alert('Success', result.message || 'Saved successfully');
        setModalVisible(false);
        setFormData({ ...initialFormState, user_id: String(currentUserId) });
        fetchCompanies();
        fetchStats();
      } else {
        Alert.alert('Error', result.message || 'Save failed');
      }
    } catch (err) {
      Alert.alert('Network error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const getBadgeStyle = (type) => {
    switch (type) {
      case 'Customer':        return { bg: '#e8f5e9', color: '#2e7d32' };
      case 'Vendor':          return { bg: '#fff3e0', color: '#e65100' };
      case 'Customer-Vendor': return { bg: '#e8eaf6', color: '#1a237e' };
      default:                return { bg: '#f1f3f5', color: '#495057' };
    }
  };

  const getInitials = () => {
    const n = sessionUser?.full_name || sessionUser?.username || 'V';
    return n.charAt(0).toUpperCase();
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

        <ScrollView contentContainerStyle={styles.mainContent} keyboardShouldPersistTaps="handled">
          {/* DEBUG banner */}
          {sessionLoaded && (
            <View style={{
              backgroundColor: '#fff3cd',
              padding: 8,
              borderRadius: 6,
              marginBottom: 12,
            }}>
              <Text style={{ fontSize: 11, color: '#856404' }}>
                {displayName} {'→ user_id: '}
                <Text style={{ fontWeight: '700' }}>{String(currentUserId)}</Text>
                {' | records: '}
                <Text style={{ fontWeight: '700' }}>{companies.length}</Text>
              </Text>
            </View>
          )}

          {/* PAGE HEADER */}
          <View style={styles.pageHeader}>
            <View style={styles.pageTitleContainer}>
              <FontAwesome5 name="users" size={18} color={GREEN} style={{ marginRight: 10 }} />
              <Text style={styles.pageTitle}>Customer / Vendor</Text>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={handleOpenAddModal}>
              <FontAwesome5 name="plus" size={12} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.addBtnText}>Add New</Text>
            </TouchableOpacity>
          </View>

          {/* STATS */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total Companies</Text>
              <Text style={styles.statValue}>{stats.total}</Text>
            </View>
            <View style={[styles.statCard, styles.borderOrange]}>
              <Text style={styles.statLabel}>Customers</Text>
              <Text style={styles.statValue}>{stats.customers}</Text>
            </View>
            <View style={[styles.statCard, styles.borderBlue]}>
              <Text style={styles.statLabel}>Vendors</Text>
              <Text style={styles.statValue}>{stats.vendors}</Text>
            </View>
            <View style={[styles.statCard, styles.borderPurple]}>
              <Text style={styles.statLabel}>Both</Text>
              <Text style={styles.statValue}>{stats.both}</Text>
            </View>
          </View>

          {/* SEARCH */}
          <View style={styles.filterSection}>
            <TextInput
              style={styles.filterInput}
              placeholder="Search by name, phone..."
              placeholderTextColor="#adb5bd"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* LIST */}
          <View style={styles.tableContainer}>
            <Text style={styles.tableTitle}>Company Directory</Text>
            {loading ? (
              <ActivityIndicator size="large" color={GREEN} style={{ marginVertical: 20 }} />
            ) : companies.length === 0 ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={styles.noDataText}>No records found.</Text>
                <Text style={{ fontSize: 11, color: '#adb5bd', marginTop: 8, textAlign: 'center' }}>
                  If web app shows records but this list is empty, user_id
                  ({String(currentUserId)}) may not match the DB.
                </Text>
              </View>
            ) : (
              companies.map((item, index) => {
                const badge = getBadgeStyle(item.company_type);
                return (
                  <View key={String(item.id || index)} style={styles.tableRowCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowCompanyName}>{item.companyname}</Text>
                      <Text style={styles.rowSubText}>Phone: {item.contactno1 || '-'}</Text>
                      {item.dl_no ? (
                        <Text style={styles.rowSubText}>DL No: {item.dl_no}</Text>
                      ) : null}
                      <View
                        style={[
                          styles.badgeContainer,
                          { backgroundColor: badge.bg, alignSelf: 'flex-start', marginTop: 4 },
                        ]}
                      >
                        <Text style={[styles.badgeText, { color: badge.color }]}>
                          {item.company_type}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.actionButtonsContainer}>
                      <TouchableOpacity
                        style={styles.viewActionBtn}
                        onPress={() => handleViewCompany(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <FontAwesome5 name="eye" size={14} color="#0d6efd" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.editActionBtn}
                        onPress={() => handleEditCompany(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <FontAwesome5 name="edit" size={14} color={GREEN} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteActionBtn}
                        onPress={() => handleDeleteCompany(item.id, item.companyname)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <FontAwesome5 name="trash" size={14} color="#dc3545" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
          <View style={{ height: 80 }} />
        </ScrollView>

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
                <Text style={styles.modalTitle}>Company Profile Details</Text>
                <TouchableOpacity onPress={() => setViewModalVisible(false)}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalBody}>
                {selectedCompany && (
                  <View style={{ gap: 10 }}>
                    {[
                      ['Company Name', selectedCompany.companyname],
                      ['Type', selectedCompany.company_type],
                      ['GSTIN', selectedCompany.gstno || '-'],
                      ['Contact Person', selectedCompany.contactperson || '-'],
                      ['Phone', selectedCompany.contactno1 || '-'],
                      ['Email', selectedCompany.email || '-'],
                      ['PAN', selectedCompany.pan || '-'],
                      ['DL No', selectedCompany.dl_no || '-'],
                      [
                        'Address',
                        `${selectedCompany.address1 || ''} ${selectedCompany.address2 || ''}, ${
                          selectedCompany.city || ''
                        }, ${selectedCompany.state || ''} - ${selectedCompany.pincode || ''}`,
                      ],
                      ['Website', selectedCompany.website || '-'],
                      ['Note', selectedCompany.note || '-'],
                    ].map(([label, value], i) => (
                      <View key={i} style={styles.detailRow}>
                        <Text style={styles.detailLabel}>{label}:</Text>
                        <Text style={styles.detailValue}>{String(value ?? '-')}</Text>
                      </View>
                    ))}
                  </View>
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
                  {formData.action === 'update'
                    ? 'Edit Company Record'
                    : 'Add Customer / Vendor'}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                <Text style={styles.sectionHeaderTitle}>Company Type</Text>
                <View style={styles.typeRow}>
                  {['Customer', 'Vendor', 'Customer-Vendor'].map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.typeChip,
                        formData.companytype === t && styles.typeChipActive,
                      ]}
                      onPress={() => setFormData({ ...formData, companytype: t })}
                    >
                      <Text
                        style={[
                          styles.typeChipText,
                          formData.companytype === t && styles.typeChipTextActive,
                        ]}
                      >
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>GSTIN</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter GSTIN Number"
                  placeholderTextColor="#adb5bd"
                  autoCapitalize="characters"
                  maxLength={15}
                  value={formData.gstno}
                  onChangeText={(val) =>
                    setFormData({ ...formData, gstno: val.toUpperCase() })
                  }
                />

                <Text style={styles.inputLabel}>Company Name *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter Company Name"
                  placeholderTextColor="#adb5bd"
                  value={formData.companyname}
                  onChangeText={(val) => setFormData({ ...formData, companyname: val })}
                />

                <Text style={styles.inputLabel}>Contact Person</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter Contact Person Name"
                  placeholderTextColor="#adb5bd"
                  value={formData.contactperson}
                  onChangeText={(val) => setFormData({ ...formData, contactperson: val })}
                />

                <Text style={styles.inputLabel}>Contact No</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter Contact Number"
                  placeholderTextColor="#adb5bd"
                  keyboardType="phone-pad"
                  value={formData.contactno1}
                  onChangeText={(val) => setFormData({ ...formData, contactno1: val })}
                />

                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter Email Address"
                  placeholderTextColor="#adb5bd"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={formData.email}
                  onChangeText={(val) => setFormData({ ...formData, email: val })}
                />

                <Text style={styles.inputLabel}>PAN</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter PAN Number"
                  placeholderTextColor="#adb5bd"
                  autoCapitalize="characters"
                  maxLength={10}
                  value={formData.pan}
                  onChangeText={(val) =>
                    setFormData({ ...formData, pan: val.toUpperCase() })
                  }
                />

                <Text style={styles.inputLabel}>
                  DL No. {formData.companytype !== 'Customer' ? '*' : ''}
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter Drug License Number"
                  placeholderTextColor="#adb5bd"
                  value={formData.dl_no}
                  onChangeText={(val) => setFormData({ ...formData, dl_no: val })}
                />

                <Text style={styles.sectionHeaderTitle}>Billing Address</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Address Line 1"
                  placeholderTextColor="#adb5bd"
                  value={formData.address1}
                  onChangeText={(val) => setFormData({ ...formData, address1: val })}
                />
                <TextInput
                  style={[styles.modalInput, { marginTop: 6 }]}
                  placeholder="Address Line 2"
                  placeholderTextColor="#adb5bd"
                  value={formData.address2}
                  onChangeText={(val) => setFormData({ ...formData, address2: val })}
                />
                <TextInput
                  style={[styles.modalInput, { marginTop: 6 }]}
                  placeholder="Landmark"
                  placeholderTextColor="#adb5bd"
                  value={formData.landmark}
                  onChangeText={(val) => setFormData({ ...formData, landmark: val })}
                />
                <TextInput
                  style={[styles.modalInput, { marginTop: 6 }]}
                  placeholder="City *"
                  placeholderTextColor="#adb5bd"
                  value={formData.city}
                  onChangeText={(val) => setFormData({ ...formData, city: val })}
                />
                <TextInput
                  style={[styles.modalInput, { marginTop: 6 }]}
                  placeholder="State *"
                  placeholderTextColor="#adb5bd"
                  value={formData.state}
                  onChangeText={(val) => setFormData({ ...formData, state: val })}
                />
                <TextInput
                  style={[styles.modalInput, { marginTop: 6 }]}
                  placeholder="Pincode"
                  placeholderTextColor="#adb5bd"
                  keyboardType="numeric"
                  value={formData.pincode}
                  onChangeText={(val) => setFormData({ ...formData, pincode: val })}
                />

                <Text style={styles.sectionHeaderTitle}>Opening Balance</Text>
                {formData.companytype === 'Vendor' ? (
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Vendor Balance Amount"
                    placeholderTextColor="#adb5bd"
                    keyboardType="numeric"
                    value={formData.balance_amount_vendor}
                    onChangeText={(val) =>
                      setFormData({ ...formData, balance_amount_vendor: val })
                    }
                  />
                ) : (
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Customer Balance Amount"
                    placeholderTextColor="#adb5bd"
                    keyboardType="numeric"
                    value={formData.balance_amount}
                    onChangeText={(val) =>
                      setFormData({ ...formData, balance_amount: val })
                    }
                  />
                )}

                <Text style={styles.sectionHeaderTitle}>Additional Details</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Website URL"
                  placeholderTextColor="#adb5bd"
                  value={formData.website}
                  onChangeText={(val) => setFormData({ ...formData, website: val })}
                />
                <TextInput
                  style={[styles.modalInput, { marginTop: 6 }]}
                  placeholder="Credit Limit"
                  placeholderTextColor="#adb5bd"
                  keyboardType="numeric"
                  value={formData.amount_limit}
                  onChangeText={(val) => setFormData({ ...formData, amount_limit: val })}
                />
                <TextInput
                  style={[styles.modalInput, { marginTop: 6, height: 60 }]}
                  placeholder="Additional Notes..."
                  placeholderTextColor="#adb5bd"
                  multiline
                  value={formData.note}
                  onChangeText={(val) => setFormData({ ...formData, note: val })}
                />
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalCloseText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveCustomer}>
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalSaveText}>
                      {formData.action === 'update' ? 'Update' : 'Save'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* DRAWER */}
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
                    {sessionUser?.firm_name || sessionUser?.full_name || 'Vagdanam Soft'}
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
                  shortcut="h"
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
                      shortcut="c"
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
                    <MenuSubItem
                      title="Company Name"
                      onPress={() => goTo('ProductCompany')}
                    />
                    <MenuSubItem title="Category" onPress={() => goTo('Category')} />
                    <MenuSubItem
                      title="Products"
                      shortcut="i"
                      onPress={() => goTo('Products')}
                    />
                    <MenuSubItem title="Stock" onPress={() => goTo('Stock')} />
                  </View>
                )}

                <MenuItem
                  icon="file-document-outline"
                  title="Sale Invoice"
                  shortcut="s"
                  onPress={() => goTo('Sales')}
                />
                <MenuItem
                  icon="file-document-edit-outline"
                  title="Purchase Invoice"
                  shortcut="p"
                  onPress={() => goTo('Purchase')}
                />

                <MenuDropdownHeader
                  icon="cash-multiple"
                  title="Payment"
                  isOpen={openDropdown === 'payment'}
                  onPress={() => toggleAccordion('payment')}
                />
                {openDropdown === 'payment' && (
                  <View style={styles.dropdownContainer}>
                    <MenuSubItem
                      title="Inward Payment (Sales)"
                      shortcut="a"
                      onPress={() => goTo('Payment', { type: 'inward' })}
                    />
                    <MenuSubItem
                      title="Outward Payment (Purchase)"
                      shortcut="g"
                      onPress={() => goTo('Payment', { type: 'outward' })}
                    />
                  </View>
                )}

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

/* ----------------------------- SUBCOMPONENTS ----------------------------- */
function MenuItem({ icon, title, shortcut, onPress, active = false }) {
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
      <Ionicons name={isOpen ? 'chevron-down' : 'chevron-forward'} size={16} color="#adb5bd" />
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

/* ----------------------------- STYLES ----------------------------- */
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
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, minWidth: '47%', backgroundColor: '#fff', borderRadius: 10,
    padding: 14, borderLeftWidth: 4, borderLeftColor: GREEN,
  },
  borderOrange: { borderLeftColor: '#e65100' },
  borderBlue: { borderLeftColor: '#0d47a1' },
  borderPurple: { borderLeftColor: '#4a148c' },
  statLabel: { fontSize: 11, color: '#868e96', fontWeight: '500' },
  statValue: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginVertical: 4 },
  filterSection: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16 },
  filterInput: {
    borderWidth: 1, borderColor: '#e9ecef', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 13,
    backgroundColor: '#fff', color: '#1a1a1a',
  },
  tableContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 20 },
  tableTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 10 },
  tableRowCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f3f5',
  },
  rowCompanyName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  rowSubText: { fontSize: 11, color: '#6c757d', marginTop: 2 },
  badgeContainer: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  actionButtonsContainer: { flexDirection: 'row', gap: 6 },
  viewActionBtn: { padding: 8, backgroundColor: '#e7f5ff', borderRadius: 6 },
  editActionBtn: { padding: 8, backgroundColor: '#e8f5e9', borderRadius: 6 },
  deleteActionBtn: { padding: 8, backgroundColor: '#ffebee', borderRadius: 6 },
  noDataText: { textAlign: 'center', color: '#868e96', fontSize: 14 },
  bottomNavigation: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e9ecef',
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', elevation: 10,
  },
  bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottomLabel: { fontSize: 10, color: '#495057', fontWeight: '600', marginTop: 2 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20,
  },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, maxHeight: '85%', overflow: 'hidden' },
  modalHeader: {
    backgroundColor: GREEN, padding: 16, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
  },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalBody: { padding: 16 },
  detailRow: {
    flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f3f5',
  },
  detailLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: '#495057' },
  detailValue: { flex: 1.5, fontSize: 13, color: '#212529' },
  sectionHeaderTitle: { fontSize: 14, fontWeight: '700', color: GREEN, marginTop: 14, marginBottom: 6 },
  inputLabel: { fontSize: 12, fontWeight: '500', color: '#4a4a4a', marginBottom: 4, marginTop: 8 },
  modalInput: {
    borderWidth: 1, borderColor: '#e9ecef', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 13,
    backgroundColor: '#fff', color: '#1a1a1a',
  },
  typeRow: { flexDirection: 'row', gap: 8, marginVertical: 4 },
  typeChip: {
    flex: 1, paddingVertical: 6, borderWidth: 1, borderColor: '#dcdcdc',
    borderRadius: 6, alignItems: 'center',
  },
  typeChipActive: { backgroundColor: GREEN, borderColor: GREEN },
  typeChipText: { fontSize: 11, color: '#495057' },
  typeChipTextActive: { color: '#fff', fontWeight: '700' },
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
  subDot: {
    width: 5, height: 5, borderRadius: 3, backgroundColor: '#adb5bd', marginRight: 11,
  },
  menuSubText: { flex: 1, fontSize: 12, color: '#6c757d' },
  shortcutKey: {
    fontSize: 10, backgroundColor: '#e9ecef', color: '#495057',
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
    marginRight: 8, overflow: 'hidden', fontWeight: '600',
  },
  menuDivider: { height: 1, backgroundColor: '#e9ecef', marginVertical: 6 },
});