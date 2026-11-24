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
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  Switch
} from "react-native";
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from "@expo/vector-icons";
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';

const GREEN = "#187A33";

export default function CreatePayment({ navigation, route }) {
  const sessionUser = route?.params?.user || { id: 1 };
  const paymentType = route?.params?.type || 'inward';
  const typeLabel = paymentType.charAt(0).toUpperCase() + paymentType.slice(1);

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    action: 'create',
    type: paymentType,
    receipt_prefix: paymentType === 'inward' ? 'REC' : 'PAY',
    receipt_no: '',
    receipt_postfix: '',
    company_name: '',
    company_id: '',
    address: '',
    gstno: '',
    paymentdate: new Date().toISOString().split('T')[0],
    amount: '',
    payment_type: 'cash',
    payment_note: '',
    currency: 'INR',
    currency_rate: '1',
    currency_amount: '',
    outstanding: '0',
    invoice_no: '',
    invoice_date: '',
    adjustment_amount: '0',
    outstanding_after: '0',
    share_email: false,
    share_sms: false,
    attachment: ''
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [invoiceDetails, setInvoiceDetails] = useState(null);

  useEffect(() => {
    generateReceiptNumber();
  }, []);

  const generateReceiptNumber = async () => {
    try {
      const response = await fetch(`https://vagdanam.com/gstapi/list_paymentreceipt.php?type=${paymentType}&ajax=generate_receipt&prefix=${formData.receipt_prefix}&postfix=${formData.receipt_postfix}`);
      const rawText = await response.text();
      const result = JSON.parse(rawText);
      if (result.status === 'success') {
        setFormData(prev => ({ ...prev, receipt_no: result.receipt_no }));
      }
    } catch (e) {
      console.error("Receipt generation error:", e);
    }
  };

  const fetchCompanySuggestions = async (keyword) => {
    if (!keyword || keyword.trim().length < 2) {
      setCompanySuggestions([]);
      setShowCompanyDropdown(false);
      return;
    }

    try {
      const response = await fetch(`https://vagdanam.com/gstapi/list_paymentreceipt.php?type=${paymentType}&ajax=search_companies&term=${encodeURIComponent(keyword.trim())}`);
      const rawText = await response.text();
      const result = JSON.parse(rawText);
      if (result.status === 'success' && result.data) {
        setCompanySuggestions(result.data);
        setShowCompanyDropdown(true);
      }
    } catch (e) {
      console.error("Company search error:", e);
    }
  };

  const selectCompany = (company) => {
    setFormData(prev => ({
      ...prev,
      company_name: company.label,
      company_id: company.id,
      address: company.address || '',
      gstno: company.gstno || ''
    }));
    setShowCompanyDropdown(false);
  };

  const searchInvoice = async () => {
    if (!formData.invoice_no.trim()) {
      alert("Please enter an invoice number to search.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`https://vagdanam.com/gstapi/list_paymentreceipt.php?type=${paymentType}&ajax=fetch_invoice&invoice_no=${encodeURIComponent(formData.invoice_no.trim())}&type=${paymentType}`);
      const rawText = await response.text();
      const result = JSON.parse(rawText);

      if (result.status === 'success' && result.data) {
        const inv = result.data;
        setInvoiceDetails(inv);
        setFormData(prev => ({
          ...prev,
          company_name: inv.company_name || prev.company_name,
          gstno: inv.gstno || prev.gstno,
          address: inv.address || prev.address,
          invoice_date: inv.invoice_date || '',
          adjustment_amount: String(inv.outstanding),
          outstanding_after: String(inv.outstanding),
          outstanding: String(inv.outstanding),
          amount: String(inv.outstanding)
        }));
        alert(`Invoice found! Auto-filled company: ${inv.company_name}`);
      } else {
        alert(result.message || "Invoice not found");
        setInvoiceDetails(null);
      }
    } catch (e) {
      console.error("Invoice search error:", e);
      alert("Network error while looking up invoice");
    } finally {
      setLoading(false);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedFile(file);
        setFormData(prev => ({ ...prev, attachment: file.name }));
      }
    } catch (err) {
      console.error("Document picking error:", err);
      alert("Failed to pick document.");
    }
  };

  const handleSavePayment = async () => {
    if (!formData.receipt_no || !formData.company_name || !formData.amount || !formData.payment_type) {
      alert("Please fill out all required fields (Receipt No, Company Name, Amount, Payment Type).");
      return;
    }

    setLoading(true);
    try {
      const dataPayload = new FormData();
      Object.keys(formData).forEach(key => {
        dataPayload.append(key, formData[key] === true ? '1' : formData[key] === false ? '0' : formData[key]);
      });

      if (selectedFile) {
        dataPayload.append('attachment_file', {
          uri: selectedFile.uri,
          name: selectedFile.name,
          type: selectedFile.mimeType || 'application/octet-stream'
        });
      }

      const response = await fetch('https://vagdanam.com/gstapi/list_paymentreceipt.php', {
        method: 'POST',
        body: dataPayload
      });

      const rawText = await response.text();
      let result;
      try {
        result = JSON.parse(rawText);
      } catch (e) {
        console.error("Parse error:", rawText);
        alert("Invalid server response format.");
        setLoading(false);
        return;
      }

      if (result.status === 'success') {
        alert(`${typeLabel} Payment saved successfully!`);
        navigation.goBack();
      } else {
        alert(result.message || "Failed to save payment record.");
      }
    } catch (err) {
      console.error("Save error:", err);
      alert("Network error while submitting payment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={GREEN} barStyle="light-content" />

      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.menuButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.brandContainer}>
            <Text style={styles.brandText}>Create {typeLabel} Payment</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Payment Details</Text>

            <Text style={styles.label}>Receipt No *</Text>
            <View style={{flexDirection: 'row', gap: 6}}>
              <TextInput style={[styles.input, {flex: 1}]} value={formData.receipt_prefix} onChangeText={(val) => setFormData({...formData, receipt_prefix: val})} />
              <TextInput style={[styles.input, {flex: 2}]} value={formData.receipt_no} onChangeText={(val) => setFormData({...formData, receipt_no: val})} />
              <TextInput style={[styles.input, {flex: 1}]} placeholder="Postfix" value={formData.receipt_postfix} onChangeText={(val) => setFormData({...formData, receipt_postfix: val})} />
            </View>

            {/* Invoice Adjustment Section with Auto-Fill */}
            <View style={styles.adjustmentCard}>
              <Text style={{fontWeight: '700', color: GREEN, marginBottom: 8}}>Invoice Adjustment & Auto-Fill</Text>
              
              <Text style={styles.subLabel}>Invoice No</Text>
              <View style={{flexDirection: 'row', gap: 6}}>
                <TextInput 
                  style={[styles.input, {flex: 1}]} 
                  placeholder="Enter Invoice No..." 
                  value={formData.invoice_no}
                  onChangeText={(val) => setFormData({...formData, invoice_no: val})}
                />
                <TouchableOpacity style={styles.searchInvBtn} onPress={searchInvoice}>
                  <Text style={{color: '#fff', fontSize: 12, fontWeight: '600'}}>Search</Text>
                </TouchableOpacity>
              </View>

              {invoiceDetails && (
                <View style={{marginTop: 8, backgroundColor: '#fff', padding: 8, borderRadius: 6}}>
                  <Text style={{fontSize: 12}}>Invoice Total: ₹{invoiceDetails.grand_total}</Text>
                  <Text style={{fontSize: 12, color: '#dc3545'}}>Outstanding: ₹{invoiceDetails.outstanding}</Text>
                </View>
              )}
            </View>

            <Text style={styles.label}>Company Name *</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Search company name or auto-filled via invoice..." 
              value={formData.company_name}
              onChangeText={(val) => {
                setFormData({...formData, company_name: val});
                fetchCompanySuggestions(val);
              }}
            />

            <Text style={styles.label}>Address</Text>
            <TextInput 
              style={[styles.input, {height: 50}]} 
              placeholder="Company address..." 
              multiline={true}
              value={formData.address}
              onChangeText={(val) => setFormData({...formData, address: val})}
            />

            <Text style={styles.label}>GSTIN / PAN</Text>
            <TextInput 
              style={styles.input} 
              placeholder="GST Number" 
              value={formData.gstno}
              onChangeText={(val) => setFormData({...formData, gstno: val})}
            />

            <Text style={styles.label}>Payment Date *</Text>
            <TouchableOpacity style={[styles.input, {justifyContent: 'center'}]} onPress={() => setShowDatePicker(true)}>
              <Text style={{color: '#333', fontSize: 13}}>{formData.paymentdate}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={new Date(formData.paymentdate)}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) setFormData({...formData, paymentdate: date.toISOString().split('T')[0]});
                }}
              />
            )}

            <Text style={styles.label}>Amount *</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Enter amount..." 
              keyboardType="numeric"
              value={formData.amount}
              onChangeText={(val) => setFormData({...formData, amount: val})}
            />

            <Text style={styles.label}>Payment Type *</Text>
            <View style={{flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4}}>
              {['cash', 'cheque', 'online_transfer', 'bank_transfer', 'tds'].map((pt) => (
                <TouchableOpacity 
                  key={pt} 
                  style={[styles.chip, formData.payment_type === pt && styles.chipActive]}
                  onPress={() => setFormData({...formData, payment_type: pt})}
                >
                  <Text style={[styles.chipText, formData.payment_type === pt && styles.chipTextActive]}>{pt.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Remarks / Note</Text>
            <TextInput 
              style={[styles.input, {height: 50}]} 
              placeholder="Payment remarks..." 
              multiline={true}
              value={formData.payment_note}
              onChangeText={(val) => setFormData({...formData, payment_note: val})}
            />

            {/* Document Upload Section */}
            <Text style={styles.label}>Attachment Document</Text>
            <TouchableOpacity style={styles.uploadBox} onPress={handlePickDocument}>
              <FontAwesome5 name="cloud-upload-alt" size={24} color={GREEN} style={{marginBottom: 6}} />
              <Text style={{fontSize: 12, fontWeight: '600', color: '#495057'}}>
                {selectedFile ? selectedFile.name : 'Click to Upload Document / Scan Report'}
              </Text>
              <Text style={{fontSize: 10, color: '#adb5bd', marginTop: 2}}>Max 5MB | PDF, JPG, PNG, DOC, XLS</Text>
            </TouchableOpacity>

            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12}}>
              <Text style={styles.label}>Share via Email</Text>
              <Switch value={formData.share_email} onValueChange={(val) => setFormData({...formData, share_email: val})} />
            </View>

            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8}}>
              <Text style={styles.label}>Share via SMS</Text>
              <Switch value={formData.share_sms} onValueChange={(val) => setFormData({...formData, share_sms: val})} />
            </View>

            <TouchableOpacity style={[styles.saveBtn, {marginTop: 20}]} onPress={handleSavePayment} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Payment</Text>}
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        <Modal visible={showCompanyDropdown} transparent={true} animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCompanyDropdown(false)}>
            <View style={styles.dropdownContainer}>
              <FlatList
                data={companySuggestions}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.dropdownItem} onPress={() => selectCompany(item)}>
                    <Text style={styles.dropdownItemTitle}>{item.label}</Text>
                    <Text style={styles.dropdownItemSub}>{item.address || 'No address provided'}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: GREEN },
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  topBar: { height: 58, backgroundColor: GREEN, flexDirection: "row", alignItems: "center", paddingHorizontal: 14 },
  menuButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  brandContainer: { flex: 1, marginLeft: 5 },
  brandText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  contentContainer: { padding: 16 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#edf0f2" },
  label: { fontSize: 12, fontWeight: "600", color: "#495057", marginBottom: 4, marginTop: 8 },
  subLabel: { fontSize: 10, fontWeight: "600", color: "#6c757d", marginBottom: 2 },
  input: { borderWidth: 1, borderColor: "#ced4da", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, backgroundColor: "#fff" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: GREEN, marginBottom: 8 },
  adjustmentCard: { backgroundColor: '#f8faf8', padding: 10, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: '#e9ecef' },
  searchInvBtn: { backgroundColor: GREEN, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 6 },
  uploadBox: { borderWidth: 2, borderColor: '#ced4da', borderStyle: 'dashed', borderRadius: 8, padding: 16, alignItems: 'center', backgroundColor: '#fafbfc', marginTop: 4 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: '#ced4da', borderRadius: 6, backgroundColor: '#f8f9fa' },
  chipActive: { backgroundColor: GREEN, borderColor: GREEN },
  chipText: { fontSize: 10, color: '#495057', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  saveBtn: { backgroundColor: GREEN, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', padding: 20 },
  dropdownContainer: { backgroundColor: '#fff', borderRadius: 8, maxHeight: 250, borderWidth: 1, borderColor: '#ced4da', elevation: 5 },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f3f5' },
  dropdownItemTitle: { fontSize: 13, fontWeight: '700', color: '#333' },
  dropdownItemSub: { fontSize: 11, color: '#6c757d', marginTop: 2 }
});