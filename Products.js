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
  Switch,
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

const API_URL = 'https://vagdanam.com/Vighna/gstapi/products_api.php';
const COMPANIES_API = 'https://vagdanam.com/Vighna/gstapi/companies_api.php';

/* ============== OPTION CONSTANTS ============== */
const ITEM_TYPES = [
  { label: 'Product', value: 'Product' },
  { label: 'Service', value: 'Service' },
];
const STOCK_TYPES = [
  { label: 'Normal', value: 'Normal' },
  { label: 'Serialized', value: 'Serialized' },
  { label: 'Batch', value: 'Batch' },
];
const TAX_TYPES = [
  { label: 'GST', value: 'GST' },
  { label: 'VAT', value: 'VAT' },
  { label: 'Sales Tax', value: 'Sales Tax' },
  { label: 'None', value: 'None' },
];
const GST_RATES = [
  { label: '0%', value: '0' },
  { label: '3%', value: '3' },
  { label: '5%', value: '5' },
  { label: '12%', value: '12' },
  { label: '18%', value: '18' },
  { label: '28%', value: '28' },
];
const IGST_RATES = [
  { label: '0%', value: '0' },
  { label: '0.1%', value: '0.1' },
  { label: '0.25%', value: '0.25' },
  { label: '0.5%', value: '0.5' },
  { label: '1%', value: '1' },
  { label: '1.5%', value: '1.5' },
  { label: '3%', value: '3' },
  { label: '5%', value: '5' },
  { label: '6%', value: '6' },
  { label: '7.5%', value: '7.5' },
  { label: '12%', value: '12' },
  { label: '18%', value: '18' },
  { label: '28%', value: '28' },
  { label: '40%', value: '40' },
];
const STATUS_OPTIONS = [
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' },
];
const DISC_TYPES = [
  { label: '₹ Rupee', value: 'rupee' },
  { label: '% Percent', value: 'percent' },
];
const DEFAULT_UOMS = ['Pcs', 'Kg', 'Ltr', 'Mtr', 'Box', 'Pack', 'Set', 'Nos'];

const emptyProduct = {
  action: 'add',
  user_id: '',
  id: '',
  name: '',
  sku: '',
  description: '',
  mfg: '',
  category_id: '',
  category: '',
  item_type: 'Product',
  uom: 'Pcs',
  expiry_date: '',
  product_note: '',
  purchase_price: '',
  sell_price: '',
  price: '',
  purchase_price_incl_tax: '',
  sell_price_incl_tax: '',
  hsn_code: '',
  gst_rate: '0',
  cgst_rate: '0',
  sgst_rate: '0',
  igst_rate: '0',
  tax_type: 'GST',
  stock: '0',
  items_available: '0',
  low_stock_alert: '5',
  stock_type: 'Normal',
  barcode_no: '',
  product_disc: '0',
  product_disc_in: 'rupee',
  product_disc_pur: '0',
  product_disc_in_pur: 'rupee',
  is_service_product: false,
  is_active: true,
  is_manufacturing: false,
  non_salable_product: false,
  status: 'Active',
};

export default function Products({ navigation, route }) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [uoms, setUoms] = useState(DEFAULT_UOMS);
  const [companies, setCompanies] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [formVisible, setFormVisible] = useState(false);
  const [viewVisible, setViewVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [uomModalVisible, setUomModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [formData, setFormData] = useState(emptyProduct);

  const [newUom, setNewUom] = useState({ uom_name: '', uom_short: '' });
  const [newCategory, setNewCategory] = useState({
    category_name: '',
    category_code: '',
    description: '',
  });

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
      } catch (e) {}
      finally { setSessionLoaded(true); }
    })();
  }, []);

  const currentUserId = sessionUser?.id ?? sessionUser?.user_id ?? null;
  const displayName = sessionUser?.full_name || sessionUser?.username || 'User';
  const getInitials = () => (displayName.charAt(0) || 'V').toUpperCase();

  /* ---------- Fetch helpers ---------- */
  const parseResponse = async (res) => {
    const raw = await res.text();
    try { return JSON.parse(raw); } catch { return null; }
  };

  const fetchProducts = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const url =
        `${API_URL}?action=list&user_id=${encodeURIComponent(currentUserId)}` +
        `&search=${encodeURIComponent(searchQuery)}` +
        `&category=${encodeURIComponent(categoryFilter)}` +
        `&status=${encodeURIComponent(statusFilter)}`;
      const res = await fetch(url);
      const data = await parseResponse(res);
      if (data?.status === 'success') {
        setProducts(Array.isArray(data.data) ? data.data : []);
      }
    } catch (e) {
      console.error('fetchProducts:', e);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, searchQuery, categoryFilter, statusFilter]);

  const fetchCategories = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const res = await fetch(`${API_URL}?action=categories&user_id=${encodeURIComponent(currentUserId)}`);
      const data = await parseResponse(res);
      if (data?.status === 'success') setCategories(data.data || []);
    } catch (e) {}
  }, [currentUserId]);

  const fetchUOMs = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const res = await fetch(`${API_URL}?action=uoms&user_id=${encodeURIComponent(currentUserId)}`);
      const data = await parseResponse(res);
      if (data?.status === 'success' && Array.isArray(data.data) && data.data.length) {
        setUoms(data.data.map((u) => u.uom_short));
      }
    } catch (e) {}
  }, [currentUserId]);

  const fetchCompanies = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const res = await fetch(`${COMPANIES_API}?user_id=${encodeURIComponent(currentUserId)}`);
      const data = await parseResponse(res);
      if (data?.status === 'success') setCompanies(data.data || []);
    } catch (e) {}
  }, [currentUserId]);

  useEffect(() => {
    if (!sessionLoaded || !currentUserId) return;
    fetchProducts();
    fetchCategories();
    fetchUOMs();
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoaded, currentUserId]);

  useEffect(() => {
    if (!sessionLoaded || !currentUserId) return;
    const t = setTimeout(fetchProducts, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, categoryFilter, statusFilter, sessionLoaded, currentUserId]);

  /* ---------- Handlers ---------- */
  const openAdd = () => {
    setFormData({ ...emptyProduct, user_id: String(currentUserId) });
    setFormVisible(true);
  };

  const openEdit = (item) => {
    setFormData({
      action: 'edit',
      user_id: String(currentUserId),
      id: String(item.id),
      name: item.name || '',
      sku: item.sku || '',
      description: item.description || '',
      mfg: item.mfg || '',
      category_id: item.category_id ? String(item.category_id) : '',
      category: item.category || '',
      item_type: item.item_type || 'Product',
      uom: item.uom || 'Pcs',
      expiry_date: item.expiry_date || '',
      product_note: item.product_note || '',
      purchase_price: item.purchase_price ? String(item.purchase_price) : '',
      sell_price: item.sell_price ? String(item.sell_price) : '',
      price: item.price ? String(item.price) : '',
      purchase_price_incl_tax: item.purchase_price_incl_tax ? String(item.purchase_price_incl_tax) : '',
      sell_price_incl_tax: item.sell_price_incl_tax ? String(item.sell_price_incl_tax) : '',
      hsn_code: item.hsn_code || '',
      gst_rate: item.gst_rate ? String(item.gst_rate) : '0',
      cgst_rate: item.cgst_rate ? String(item.cgst_rate) : '0',
      sgst_rate: item.sgst_rate ? String(item.sgst_rate) : '0',
      igst_rate: item.igst_rate ? String(item.igst_rate) : '0',
      tax_type: item.tax_type || 'GST',
      stock: item.stock ? String(item.stock) : '0',
      items_available: item.items_available ? String(item.items_available) : '0',
      low_stock_alert: item.low_stock_alert ? String(item.low_stock_alert) : '5',
      stock_type: item.stock_type || 'Normal',
      barcode_no: item.barcode_no || '',
      product_disc: item.product_disc ? String(item.product_disc) : '0',
      product_disc_in: item.product_disc_in || 'rupee',
      product_disc_pur: item.product_disc_pur ? String(item.product_disc_pur) : '0',
      product_disc_in_pur: item.product_disc_in_pur || 'rupee',
      is_service_product: item.is_service_product == 1,
      is_active: item.is_active == 1,
      is_manufacturing: item.is_manufacturing == 1,
      non_salable_product: item.non_salable_product == 1,
      status: item.status || 'Active',
    });
    setFormVisible(true);
  };

  const openView = (item) => { setSelectedProduct(item); setViewVisible(true); };
  const openDelete = (item) => { setSelectedProduct(item); setDeleteVisible(true); };

  const updateGstRate = (rate) => {
    const half = (Number(rate) / 2).toFixed(2);
    setFormData((fd) => ({
      ...fd,
      gst_rate: rate,
      cgst_rate: half,
      sgst_rate: half,
    }));
    recalcInclusive({ ...formData, gst_rate: rate });
  };

  const recalcInclusive = (fd) => {
    const gst = Number(fd.gst_rate) || 0;
    const m = 1 + gst / 100;
    const sellEx = Number(fd.sell_price) || 0;
    const purEx = Number(fd.purchase_price) || 0;
    setFormData((prev) => ({
      ...prev,
      sell_price_incl_tax: (gst > 0 ? sellEx * m : sellEx).toFixed(2),
      purchase_price_incl_tax: (gst > 0 ? purEx * m : purEx).toFixed(2),
    }));
  };

  const updateField = (key, value) => {
    const next = { ...formData, [key]: value };
    setFormData(next);
    if (['sell_price', 'purchase_price', 'gst_rate'].includes(key)) {
      recalcInclusive(next);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return Alert.alert('Validation', 'Product name is required');
    if (!formData.sell_price || Number(formData.sell_price) < 0)
      return Alert.alert('Validation', 'Valid selling price is required');
    if (!formData.mfg.trim()) return Alert.alert('Validation', 'Company name is required');
    if (!formData.category_id) return Alert.alert('Validation', 'Please select a category');
    if (!formData.uom.trim()) return Alert.alert('Validation', 'Please select or type UOM');

    const payload = {
      ...formData,
      user_id: String(currentUserId),
      is_active: formData.is_active ? '1' : '0',
      is_service_product: formData.is_service_product ? '1' : '0',
      is_manufacturing: formData.is_manufacturing ? '1' : '0',
      non_salable_product: formData.non_salable_product ? '1' : '0',
      category_id: formData.category_id || '0',
    };

    const body = Object.entries(payload)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v ?? '')}`)
      .join('&');

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}?action=save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const data = await parseResponse(res);
      if (data?.status === 'success') {
        Alert.alert('Success', data.message || 'Saved successfully');
        setFormVisible(false);
        setFormData({ ...emptyProduct, user_id: String(currentUserId) });
        fetchProducts();
      } else {
        Alert.alert('Error', data?.message || 'Save failed');
      }
    } catch (e) {
      Alert.alert('Network error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedProduct) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}?action=delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `id=${encodeURIComponent(selectedProduct.id)}&user_id=${encodeURIComponent(currentUserId)}`,
      });
      const data = await parseResponse(res);
      if (data?.status === 'success') {
        Alert.alert('Deleted', data.message || 'Deleted successfully');
        setDeleteVisible(false);
        setSelectedProduct(null);
        fetchProducts();
      } else {
        Alert.alert('Error', data?.message || 'Delete failed');
      }
    } catch (e) {
      Alert.alert('Network error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUom = async () => {
    if (!newUom.uom_name.trim() || !newUom.uom_short.trim()) {
      return Alert.alert('Validation', 'Both fields are required');
    }
    try {
      const res = await fetch(`${API_URL}?action=add_uom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:
          `user_id=${encodeURIComponent(currentUserId)}` +
          `&uom_name=${encodeURIComponent(newUom.uom_name)}` +
          `&uom_short=${encodeURIComponent(newUom.uom_short)}`,
      });
      const data = await parseResponse(res);
      if (data?.status === 'success') {
        setUoms((prev) => [...new Set([...prev, newUom.uom_short])]);
        setFormData((fd) => ({ ...fd, uom: newUom.uom_short }));
        setNewUom({ uom_name: '', uom_short: '' });
        setUomModalVisible(false);
        Alert.alert('Success', 'UOM added');
      } else {
        Alert.alert('Error', data?.message || 'Failed');
      }
    } catch (e) { Alert.alert('Network error', e.message); }
  };

  const handleAddCategory = async () => {
    if (!newCategory.category_name.trim()) {
      return Alert.alert('Validation', 'Category name is required');
    }
    try {
      const res = await fetch(`${API_URL}?action=add_category`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:
          `user_id=${encodeURIComponent(currentUserId)}` +
          `&category_name=${encodeURIComponent(newCategory.category_name)}` +
          `&category_code=${encodeURIComponent(newCategory.category_code)}` +
          `&description=${encodeURIComponent(newCategory.description)}`,
      });
      const data = await parseResponse(res);
      if (data?.status === 'success') {
        await fetchCategories();
        setFormData((fd) => ({
          ...fd,
          category_id: String(data.id),
          category: newCategory.category_name,
        }));
        setNewCategory({ category_name: '', category_code: '', description: '' });
        setCategoryModalVisible(false);
        Alert.alert('Success', 'Category added');
      } else {
        Alert.alert('Error', data?.message || 'Failed');
      }
    } catch (e) { Alert.alert('Network error', e.message); }
  };

  /* ---------- Navigation ---------- */
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

  const stockBadge = (product) => {
    const stock = Number(product.stock) || 0;
    const alert = Number(product.low_stock_alert) || 0;
    if (stock <= 0) return { bg: '#ffebee', fg: '#c62828', text: 'Out of Stock' };
    if (alert > 0 && stock <= alert) return { bg: '#fff3e0', fg: '#e65100', text: 'Low Stock' };
    return { bg: '#e8f5e9', fg: '#2e7d32', text: 'In Stock' };
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
              <Text style={styles.brandSubText} numberOfLines={1}>{displayName}</Text>
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
              <FontAwesome5 name="boxes" size={18} color={GREEN} style={{ marginRight: 10 }} />
              <Text style={styles.pageTitle}>Products / Services</Text>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
              <FontAwesome5 name="plus" size={12} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.addBtnText}>Add Product</Text>
            </TouchableOpacity>
          </View>

          {/* FILTERS */}
          <View style={styles.filterSection}>
            <TextInput
              style={styles.filterInput}
              placeholder="Search by name, SKU, barcode..."
              placeholderTextColor="#adb5bd"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <Text style={styles.filterLabelSmall}>Category</Text>
            <Dropdown
              placeholder="All Categories"
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[{ label: 'All Categories', value: '' },
                ...categories.map((c) => ({ label: c.category_name, value: c.category_name }))]}
            />
            <Text style={styles.filterLabelSmall}>Status</Text>
            <Dropdown
              placeholder="All Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { label: 'All Status', value: '' },
                { label: 'In Stock', value: 'instock' },
                { label: 'Low Stock', value: 'lowstock' },
                { label: 'Out of Stock', value: 'outofstock' },
              ]}
            />
          </View>

          {/* LIST */}
          <View style={styles.tableContainer}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableTitle}>
                <FontAwesome5 name="list" size={12} color={GREEN} />  Product List
              </Text>
              <Text style={styles.tableCount}>Total: <Text style={{ fontWeight: '700' }}>{products.length}</Text></Text>
            </View>

            {loading ? (
              <ActivityIndicator size="large" color={GREEN} style={{ marginVertical: 20 }} />
            ) : products.length === 0 ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <FontAwesome5 name="inbox" size={32} color="#adb5bd" />
                <Text style={styles.noDataText}>No products found. Tap "Add Product" to create one.</Text>
              </View>
            ) : (
              products.map((item, idx) => {
                const badge = stockBadge(item);
                return (
                  <View key={String(item.id || idx)} style={styles.rowCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{item.name}</Text>
                      {!!item.mfg && (
                        <Text style={styles.rowSub}>
                          <FontAwesome5 name="building" size={10} color="#6c757d" /> {item.mfg}
                        </Text>
                      )}
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                        <Badge text={badge.text} tone={badge} />
                        {!!item.uom && (
                          <View style={[styles.badge, { backgroundColor: '#e8f5e9' }]}>
                            <Text style={[styles.badgeText, { color: '#2e7d32' }]}>{item.uom}</Text>
                          </View>
                        )}
                        {!!item.category && (
                          <View style={[styles.badge, { backgroundColor: '#e3f2fd' }]}>
                            <Text style={[styles.badgeText, { color: '#0d47a1' }]}>{item.category}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.priceText}>
                        ₹ {Number(item.sell_price || item.price || 0).toFixed(2)} · Stock: {item.stock || 0}
                      </Text>
                    </View>
                    <View style={styles.actions}>
                      <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#e3f2fd' }]}
                        onPress={() => openView(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <FontAwesome5 name="eye" size={12} color="#0d6efd" />
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#e8f5e9' }]}
                        onPress={() => openEdit(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <FontAwesome5 name="edit" size={12} color={GREEN} />
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#ffebee' }]}
                        onPress={() => openDelete(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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

        {/* ================= ADD / EDIT PRODUCT MODAL ================= */}
        <Modal visible={formVisible} animationType="slide" transparent onRequestClose={() => setFormVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '94%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {formData.action === 'edit' ? 'Edit Product' : 'Add Product'}
                </Text>
                <TouchableOpacity onPress={() => setFormVisible(false)}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">

                <SectionHeader icon="info-circle" title="Basic Information" />

                <FormInput
                  label="Product Name *"
                  value={formData.name}
                  onChangeText={(v) => updateField('name', v)}
                  placeholder="Enter product name"
                />

                <FormInput
                  label="SKU / Batch No"
                  value={formData.sku}
                  onChangeText={(v) => updateField('sku', v)}
                  placeholder="Auto-generated if empty"
                />

                <FormInput
                  label="Description"
                  value={formData.description}
                  onChangeText={(v) => updateField('description', v)}
                  multiline
                  placeholder="Product description..."
                />

                <Text style={styles.inputLabel}>Company Name *</Text>
                <Dropdown
                  placeholder="Select Company"
                  value={formData.mfg}
                  onChange={(v) => updateField('mfg', v)}
                  options={companies.map((c) => ({ label: c.company_name, value: c.company_name }))}
                />

                <Text style={styles.inputLabel}>Category *</Text>
                <Dropdown
                  placeholder="Select Category"
                  value={formData.category_id}
                  onChange={(v) => {
                    const cat = categories.find((c) => String(c.id) === String(v));
                    setFormData({
                      ...formData,
                      category_id: v,
                      category: cat?.category_name || '',
                    });
                  }}
                  options={categories.map((c) => ({ label: c.category_name, value: String(c.id) }))}
                />
                <TouchableOpacity style={styles.smallActionBtn} onPress={() => setCategoryModalVisible(true)}>
                  <FontAwesome5 name="plus" size={10} color="#0d6efd" />
                  <Text style={styles.smallActionText}>Add New Category</Text>
                </TouchableOpacity>

                <Text style={styles.inputLabel}>Item Type</Text>
                <Dropdown
                  value={formData.item_type}
                  onChange={(v) => updateField('item_type', v)}
                  options={ITEM_TYPES}
                />

                <Text style={styles.inputLabel}>Unit of Measurement (UOM) *</Text>
                <Dropdown
                  value={formData.uom}
                  onChange={(v) => updateField('uom', v)}
                  options={uoms.map((u) => ({ label: u, value: u }))}
                />
                <TouchableOpacity style={[styles.smallActionBtn, { backgroundColor: '#e8f5e9' }]}
                  onPress={() => setUomModalVisible(true)}>
                  <FontAwesome5 name="plus" size={10} color={GREEN} />
                  <Text style={[styles.smallActionText, { color: GREEN }]}>Add New UOM</Text>
                </TouchableOpacity>

                <FormInput
                  label="Expiry Date (YYYY-MM-DD)"
                  value={formData.expiry_date}
                  onChangeText={(v) => updateField('expiry_date', v)}
                  placeholder="2026-12-31"
                />
                <FormInput
                  label="Product Note"
                  value={formData.product_note}
                  onChangeText={(v) => updateField('product_note', v)}
                  multiline
                />

                <SectionHeader icon="money-bill-wave" title="Pricing & Tax Information" />

                <FormInput
                  label="Purchase Price (Excl. Tax)"
                  value={formData.purchase_price}
                  onChangeText={(v) => updateField('purchase_price', v)}
                  keyboardType="numeric"
                  placeholder="0.00"
                />
                <FormInput
                  label="Selling Price (Excl. Tax) *"
                  value={formData.sell_price}
                  onChangeText={(v) => updateField('sell_price', v)}
                  keyboardType="numeric"
                  placeholder="0.00"
                />
                <FormInput
                  label="MRP"
                  value={formData.price}
                  onChangeText={(v) => updateField('price', v)}
                  keyboardType="numeric"
                  placeholder="0.00"
                />

                <FormInput
                  label="Purchase (Incl. Tax)"
                  value={formData.purchase_price_incl_tax}
                  onChangeText={(v) => updateField('purchase_price_incl_tax', v)}
                  keyboardType="numeric"
                />
                <FormInput
                  label="Selling (Incl. Tax)"
                  value={formData.sell_price_incl_tax}
                  onChangeText={(v) => updateField('sell_price_incl_tax', v)}
                  keyboardType="numeric"
                />

                <FormInput
                  label="HSN Code"
                  value={formData.hsn_code}
                  onChangeText={(v) => updateField('hsn_code', v)}
                  placeholder="e.g., 8471"
                />

                <Text style={styles.inputLabel}>GST Rate (%)</Text>
                <Dropdown
                  value={formData.gst_rate}
                  onChange={updateGstRate}
                  options={GST_RATES}
                />

                <Text style={styles.inputLabel}>Tax Type</Text>
                <Dropdown
                  value={formData.tax_type}
                  onChange={(v) => updateField('tax_type', v)}
                  options={TAX_TYPES}
                />

                <FormInput
                  label="CGST Rate (%)  — auto"
                  value={formData.cgst_rate}
                  editable={false}
                />
                <FormInput
                  label="SGST Rate (%)  — auto"
                  value={formData.sgst_rate}
                  editable={false}
                />

                <Text style={styles.inputLabel}>IGST Rate (%)</Text>
                <Dropdown
                  value={formData.igst_rate}
                  onChange={(v) => updateField('igst_rate', v)}
                  options={IGST_RATES}
                />

                <View style={styles.switchRow}>
                  <Text style={styles.inputLabel}>Service Product</Text>
                  <Switch
                    value={formData.is_service_product}
                    onValueChange={(v) => updateField('is_service_product', v)}
                    trackColor={{ false: '#ccc', true: GREEN }}
                  />
                </View>

                <SectionHeader icon="boxes" title="Stock Information" />

                <FormInput
                  label="Stock Quantity"
                  value={formData.stock}
                  onChangeText={(v) => updateField('stock', v)}
                  keyboardType="numeric"
                />
                <FormInput
                  label="Items Available"
                  value={formData.items_available}
                  onChangeText={(v) => updateField('items_available', v)}
                  keyboardType="numeric"
                />
                <FormInput
                  label="Low Stock Alert"
                  value={formData.low_stock_alert}
                  onChangeText={(v) => updateField('low_stock_alert', v)}
                  keyboardType="numeric"
                />

                <Text style={styles.inputLabel}>Stock Type</Text>
                <Dropdown
                  value={formData.stock_type}
                  onChange={(v) => updateField('stock_type', v)}
                  options={STOCK_TYPES}
                />

                <SectionHeader icon="percent" title="Discount Information" />

                <Text style={styles.inputLabel}>Discount (Sale)</Text>
                <View style={styles.inlineRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                    value={formData.product_disc}
                    onChangeText={(v) => updateField('product_disc', v)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#adb5bd"
                  />
                  <View style={{ width: 120 }}>
                    <Dropdown
                      value={formData.product_disc_in}
                      onChange={(v) => updateField('product_disc_in', v)}
                      options={DISC_TYPES}
                    />
                  </View>
                </View>

                <Text style={styles.inputLabel}>Discount (Purchase)</Text>
                <View style={styles.inlineRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                    value={formData.product_disc_pur}
                    onChangeText={(v) => updateField('product_disc_pur', v)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#adb5bd"
                  />
                  <View style={{ width: 120 }}>
                    <Dropdown
                      value={formData.product_disc_in_pur}
                      onChange={(v) => updateField('product_disc_in_pur', v)}
                      options={DISC_TYPES}
                    />
                  </View>
                </View>

                <SectionHeader icon="cog" title="Additional Information" />

                <FormInput
                  label="Barcode Number"
                  value={formData.barcode_no}
                  onChangeText={(v) => updateField('barcode_no', v)}
                  placeholder="Scan or enter barcode"
                />

                <Text style={styles.inputLabel}>Status</Text>
                <Dropdown
                  value={formData.status}
                  onChange={(v) => updateField('status', v)}
                  options={STATUS_OPTIONS}
                />

                <View style={styles.switchRow}>
                  <Text style={styles.inputLabel}>Active</Text>
                  <Switch
                    value={formData.is_active}
                    onValueChange={(v) => updateField('is_active', v)}
                    trackColor={{ false: '#ccc', true: GREEN }}
                  />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.inputLabel}>Manufacturing Product</Text>
                  <Switch
                    value={formData.is_manufacturing}
                    onValueChange={(v) => updateField('is_manufacturing', v)}
                    trackColor={{ false: '#ccc', true: GREEN }}
                  />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.inputLabel}>Non-Salable Product</Text>
                  <Switch
                    value={formData.non_salable_product}
                    onValueChange={(v) => updateField('non_salable_product', v)}
                    trackColor={{ false: '#ccc', true: GREEN }}
                  />
                </View>

                <View style={{ height: 20 }} />
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setFormVisible(false)}>
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

        {/* ================= VIEW MODAL ================= */}
        <Modal visible={viewVisible} animationType="slide" transparent onRequestClose={() => setViewVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Product Details</Text>
                <TouchableOpacity onPress={() => setViewVisible(false)}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalBody}>
                {selectedProduct && (
                  <>
                    <DetailRow label="Product Name" value={selectedProduct.name} />
                    <DetailRow label="Company" value={selectedProduct.mfg} />
                    <DetailRow label="SKU" value={selectedProduct.sku} />
                    <DetailRow label="Category" value={selectedProduct.category} />
                    <DetailRow label="Description" value={selectedProduct.description} />
                    <DetailRow label="Selling Price" value={`₹ ${Number(selectedProduct.sell_price || selectedProduct.price || 0).toFixed(2)}`} />
                    <DetailRow label="Purchase Price" value={`₹ ${Number(selectedProduct.purchase_price || 0).toFixed(2)}`} />
                    <DetailRow label="MRP" value={`₹ ${Number(selectedProduct.price || 0).toFixed(2)}`} />
                    <DetailRow label="HSN Code" value={selectedProduct.hsn_code} />
                    <DetailRow label="GST Rate" value={`${selectedProduct.gst_rate || 0}%`} />
                    <DetailRow label="Tax Type" value={selectedProduct.tax_type} />
                    <DetailRow label="Stock" value={selectedProduct.stock} />
                    <DetailRow label="UOM" value={selectedProduct.uom} />
                    <DetailRow label="Expiry" value={selectedProduct.expiry_date || 'N/A'} />
                    <DetailRow label="Status" value={selectedProduct.status || (selectedProduct.is_active == 1 ? 'Active' : 'Inactive')} />
                    <DetailRow label="Service" value={selectedProduct.is_service_product == 1 ? 'Yes' : 'No'} />
                    <DetailRow label="Manufacturing" value={selectedProduct.is_manufacturing == 1 ? 'Yes' : 'No'} />
                    <DetailRow label="Non-Salable" value={selectedProduct.non_salable_product == 1 ? 'Yes' : 'No'} />
                  </>
                )}
              </ScrollView>
              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setViewVisible(false)}>
                  <Text style={styles.modalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ================= DELETE MODAL ================= */}
        <Modal visible={deleteVisible} animationType="fade" transparent onRequestClose={() => setDeleteVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={[styles.modalHeader, { backgroundColor: '#dc3545' }]}>
                <Text style={styles.modalTitle}>Confirm Delete</Text>
                <TouchableOpacity onPress={() => setDeleteVisible(false)}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                <Text style={{ fontSize: 15, color: '#4a4a4a' }}>Delete product:</Text>
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#1a1a1a', marginTop: 8 }}>
                  {selectedProduct?.name}
                </Text>
                <Text style={{ color: '#dc3545', marginTop: 12 }}>This action cannot be undone!</Text>
              </View>
              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setDeleteVisible(false)}>
                  <Text style={styles.modalCloseText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveBtn, { backgroundColor: '#dc3545' }]}
                  onPress={handleDelete}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSaveText}>Delete</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ================= UOM MODAL ================= */}
        <Modal visible={uomModalVisible} animationType="slide" transparent onRequestClose={() => setUomModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add New UOM</Text>
                <TouchableOpacity onPress={() => setUomModalVisible(false)}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalBody}>
                <FormInput label="UOM Name *" value={newUom.uom_name}
                  onChangeText={(v) => setNewUom({ ...newUom, uom_name: v })} placeholder="e.g., Kilogram" />
                <FormInput label="UOM Short Code *" value={newUom.uom_short}
                  onChangeText={(v) => setNewUom({ ...newUom, uom_short: v })} placeholder="e.g., Kg" maxLength={10} />
              </ScrollView>
              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setUomModalVisible(false)}>
                  <Text style={styles.modalCloseText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddUom}>
                  <Text style={styles.modalSaveText}>Save UOM</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ================= CATEGORY MODAL ================= */}
        <Modal visible={categoryModalVisible} animationType="slide" transparent onRequestClose={() => setCategoryModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add New Category</Text>
                <TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalBody}>
                <FormInput label="Category Name *" value={newCategory.category_name}
                  onChangeText={(v) => setNewCategory({ ...newCategory, category_name: v })} />
                <FormInput label="Category Code" value={newCategory.category_code}
                  onChangeText={(v) => setNewCategory({ ...newCategory, category_code: v })} />
                <FormInput label="Description" value={newCategory.description}
                  onChangeText={(v) => setNewCategory({ ...newCategory, description: v })} multiline />
              </ScrollView>
              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setCategoryModalVisible(false)}>
                  <Text style={styles.modalCloseText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddCategory}>
                  <Text style={styles.modalSaveText}>Save Category</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ================= DRAWER ================= */}
        {menuOpen && (
          <View style={styles.menuOverlay}>
            <TouchableOpacity style={styles.overlayBackground} activeOpacity={1} onPress={() => setMenuOpen(false)} />
            <View style={styles.drawer}>
              <View style={styles.drawerHeader}>
                <View style={styles.drawerBrandIcon}>
                  <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>{getInitials()}</Text>
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
                <MenuDropdownHeader icon="account-group" title="Customer / Vendor"
                  isOpen={openDropdown === 'customer'} onPress={() => toggleAccordion('customer')} />
                {openDropdown === 'customer' && (
                  <View style={styles.dropdownContainer}>
                    <MenuSubItem title="Customer / Vendor" onPress={() => goTo('CustomerScreen')} />
                    <MenuSubItem title="Customer / Vendor Group" onPress={() => goTo('CustomerGroup')} />
                  </View>
                )}
                <MenuDropdownHeader icon="package-variant-closed" title="Products"
                  isOpen={openDropdown === 'products'} onPress={() => toggleAccordion('products')} />
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
          <TouchableOpacity style={styles.bottomItem} onPress={() => goTo('CustomerScreen')}>
            <Ionicons name="people-outline" size={22} color="#666" />
            <Text style={styles.bottomLabel}>Customer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomItem} onPress={() => goTo('Category')}>
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

/* ================= SUB-COMPONENTS ================= */
function Badge({ text, tone }) {
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.badgeText, { color: tone.fg }]}>{text}</Text>
    </View>
  );
}
function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}:</Text>
      <Text style={styles.detailValue}>{String(value ?? '-')}</Text>
    </View>
  );
}
function SectionHeader({ icon, title }) {
  return (
    <View style={styles.sectionHeader}>
      <FontAwesome5 name={icon} size={13} color={GREEN} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}
function FormInput({ label, ...props }) {
  return (
    <>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          props.multiline && { height: 80, textAlignVertical: 'top' },
          props.editable === false && { backgroundColor: '#f1f3f5', color: '#6c757d' },
        ]}
        placeholderTextColor="#adb5bd"
        {...props}
      />
    </>
  );
}
function Dropdown({ value, onChange, options, placeholder, style }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => String(o.value) === String(value));
  return (
    <View style={[styles.dropdownWrap, style]}>
      <TouchableOpacity style={styles.dropdownBtn} onPress={() => setOpen(!open)}>
        <Text style={[styles.dropdownBtnText, !selected && { color: '#adb5bd' }]}>
          {selected?.label || placeholder || 'Select'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color="#666" />
      </TouchableOpacity>
      {open && (
        <View style={styles.dropdownList}>
          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
            {options.length === 0 ? (
              <Text style={styles.dropdownEmpty}>No options</Text>
            ) : (
              options.map((opt) => (
                <TouchableOpacity
                  key={String(opt.value)}
                  style={styles.dropdownItem}
                  onPress={() => { onChange(opt.value); setOpen(false); }}
                >
                  <Text style={[
                    styles.dropdownItemText,
                    String(opt.value) === String(value) && { color: GREEN, fontWeight: '700' },
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}
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
function MenuDivider() { return <View style={styles.menuDivider} />; }

/* ================= STYLES ================= */
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
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: GREEN, fontSize: 14, fontWeight: '800' },

  mainContent: { padding: 14 },
  pageHeader: {
    backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  pageTitleContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  pageTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  addBtn: { backgroundColor: GREEN, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  filterSection: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12 },
  filterLabelSmall: { fontSize: 11, fontWeight: '700', color: '#495057', marginTop: 10 },
  filterInput: {
    borderWidth: 1, borderColor: '#e9ecef', borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13,
    backgroundColor: '#fff', color: '#1a1a1a',
  },

  tableContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16 },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10 },
  tableTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  tableCount: { fontSize: 12, color: '#868e96' },
  noDataText: { textAlign: 'center', color: '#868e96', fontSize: 13, marginTop: 10 },

  rowCard: { flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f3f5' },
  rowTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  rowSub: { fontSize: 11, color: '#6c757d', marginTop: 2 },
  priceText: { fontSize: 12, color: '#495057', marginTop: 6, fontWeight: '600' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
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

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 10 },
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

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 16, marginBottom: 8, paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: '#e9ecef',
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },

  inputLabel: { fontSize: 12, fontWeight: '600', color: '#4a4a4a', marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#e9ecef', borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13,
    backgroundColor: '#fafbfc', color: '#1a1a1a',
  },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 12, padding: 10, backgroundColor: '#f8f9fa', borderRadius: 8,
  },
  smallActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 6, paddingVertical: 8, paddingHorizontal: 10,
    backgroundColor: '#e3f2fd', borderRadius: 6, alignSelf: 'flex-start',
  },
  smallActionText: { fontSize: 11, fontWeight: '700', color: '#0d6efd' },
  inlineRow: { flexDirection: 'row', alignItems: 'flex-start' },

  detailRow: {
    flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f3f5',
  },
  detailLabel: { width: 130, fontSize: 13, fontWeight: '600', color: '#495057' },
  detailValue: { flex: 1, fontSize: 13, color: '#212529' },

  dropdownWrap: { position: 'relative', zIndex: 10 },
  dropdownBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: '#e9ecef', borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 11, backgroundColor: '#fafbfc',
  },
  dropdownBtnText: { fontSize: 13, color: '#1a1a1a' },
  dropdownList: {
    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
    backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#e9ecef',
    elevation: 6, zIndex: 100,
  },
  dropdownItem: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f1f3f5',
  },
  dropdownItemText: { fontSize: 13, color: '#495057' },
  dropdownEmpty: { padding: 12, fontSize: 12, color: '#868e96', textAlign: 'center' },

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

  menuItem: { minHeight: 48, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#f1f3f5' },
  menuItemActive: { backgroundColor: LIGHT_GREEN, borderLeftWidth: 3, borderLeftColor: GREEN },
  menuItemText: { flex: 1, marginLeft: 13, fontSize: 13, color: '#495057', fontWeight: '500' },
  menuItemTextActive: { color: GREEN, fontWeight: '700' },
  menuSection: { minHeight: 47, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, backgroundColor: '#fafcfb',
    borderBottomWidth: 1, borderBottomColor: '#f1f3f5' },
  menuSectionText: { flex: 1, marginLeft: 13, fontSize: 13, color: '#343a40', fontWeight: '700' },
  dropdownContainer: { backgroundColor: '#f8f9fa', paddingVertical: 2 },
  menuSubItem: { minHeight: 38, flexDirection: 'row', alignItems: 'center',
    paddingLeft: 46, paddingRight: 18 },
  subDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#adb5bd', marginRight: 11 },
  menuSubText: { flex: 1, fontSize: 12, color: '#6c757d' },
  menuDivider: { height: 1, backgroundColor: '#e9ecef', marginVertical: 6 },
});