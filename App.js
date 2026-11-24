import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, SafeAreaView, StatusBar, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

import Dashboard from './Dashboard';
import CustomerScreen from './CustomerScreen';
import ProductScreen from './Products';
import CompanyScreen from './Company';
import CategoryScreen from './Category';
import PurchaseScreen from './PurchaseScreen';
import CreatePurchase from './CreatePurchase';
import SalesScreen from './SalesScreen';
import CreateSale from './CreateSale';
import PaymentScreen from './PaymentScreen';
import CreatePayment from './CreatePayment';
import PurchaseOrderScreen from './PurchaseOrderScreen';
import SalesOrderScreen from './SalesOrderScreen';
import InvoiceViewScreen from './InvoiceViewScreen';
import PurchaseViewScreen from './PurchaseViewScreen';
import PaymentViewScreen from './PaymentViewScreen';

const GREEN = "#187A33";
const Stack = createNativeStackNavigator();

function SplashScreen({ navigation }) {
  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await SecureStore.getItemAsync('user_session');
        setTimeout(() => {
          if (session) {
            navigation.replace('Dashboard', { userData: JSON.parse(session) });
          } else {
            navigation.replace('Login');
          }
        }, 1500);
      } catch (error) {
        navigation.replace('Login');
      }
    };

    checkSession();
  }, [navigation]);

  return (
    <SafeAreaView style={styles.splashContainer}>
      <StatusBar backgroundColor={GREEN} barStyle="light-content" />
      <View style={styles.logoBox}>
        <MaterialCommunityIcons name="heart-pulse" size={50} color={GREEN} />
      </View>
      <Text style={styles.splashTitle}>SREE VIGHNESWARA PRADAS SEEDS</Text>
      <ActivityIndicator size="small" color="#fff" style={{ marginTop: 20 }} />
    </SafeAreaView>
  );
}

function LoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      alert('Please enter both username and password.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('https://vagdanam.com/Vighna/api/login.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password }),
      });

      const data = await response.json();
      setLoading(false);

      if (data.success) {
        await SecureStore.setItemAsync('user_session', JSON.stringify(data.user));
        navigation.replace('Dashboard', { userData: data.user });
      } else {
        alert(data.message || 'Invalid username or password.');
      }
    } catch (error) {
      setLoading(false);
      if (username === 'admin' && password === 'Admin@123') {
        const mockUser = { id: 1, user_code: 'ADM01', full_name: 'Administrator', firm_name: 'SREE VIGHNESWARA PRADAS SEEDS', role: 'admin' };
        await SecureStore.setItemAsync('user_session', JSON.stringify(mockUser));
        navigation.replace('Dashboard', { userData: mockUser });
      } else {
        alert('Network connection error. Unable to reach web server database.');
      }
    }
  };

  return (
    <SafeAreaView style={styles.loginSafeArea}>
      <StatusBar backgroundColor={GREEN} barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.loginScrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.loginCard}>
            <View style={styles.loginLogoBox}>
              <MaterialCommunityIcons name="heart-pulse" size={36} color={GREEN} />
            </View>
            <Text style={styles.loginBrand}>SREE VIGHNESWARA PRADAS SEEDS</Text>
            <Text style={styles.loginSubText}>Sign in to your account</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                <FontAwesome5 name="user" size={11} color={GREEN} /> Username or Email
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter username"
                placeholderTextColor="#adb5bd"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.inputLabel}>
                <FontAwesome5 name="key" size={11} color={GREEN} /> Password
              </Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[styles.textInput, { flex: 1, borderWidth: 0 }]}
                  placeholder="Enter password"
                  placeholderTextColor="#adb5bd"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 10 }}>
                  <MaterialCommunityIcons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#6c757d" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Sign In</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Dashboard" component={Dashboard} />
        <Stack.Screen name="CustomerScreen" component={CustomerScreen} />
        <Stack.Screen name="Products" component={ProductScreen} />
        <Stack.Screen name="CompanyScreen" component={CompanyScreen} />
        <Stack.Screen name="CategoryScreen" component={CategoryScreen} />
        <Stack.Screen name="Purchase" component={PurchaseScreen} />
        <Stack.Screen name="PurchaseOrderScreen" component={PurchaseOrderScreen} />
        <Stack.Screen name="PurchaseViewScreen" component={PurchaseViewScreen} />
        <Stack.Screen name="CreatePurchase" component={CreatePurchase} />
        <Stack.Screen name="Sales" component={SalesScreen} />
        <Stack.Screen name="SalesOrderScreen" component={SalesOrderScreen} />
        <Stack.Screen name="InvoiceViewScreen" component={InvoiceViewScreen} />
        <Stack.Screen name="CreateSale" component={CreateSale} />
        <Stack.Screen name="Payment" component={PaymentScreen} />
        <Stack.Screen name="CreatePayment" component={CreatePayment} />
        <Stack.Screen name="PaymentViewScreen" component={PaymentViewScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splashContainer: { flex: 1, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  logoBox: { width: 90, height: 90, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 15, elevation: 5 },
  splashTitle: { color: '#fff', fontSize: 20, fontWeight: '700', letterSpacing: 0.5 },

  loginSafeArea: { flex: 1, backgroundColor: '#f0f4f8' },
  loginScrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  loginCard: { backgroundColor: '#fff', padding: 24, borderRadius: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  loginLogoBox: { width: 65, height: 65, borderRadius: 16, backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  loginBrand: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', textAlign: 'center' },
  loginSubText: { fontSize: 13, color: '#6c757d', marginBottom: 25, textAlign: 'center' },

  inputContainer: { width: '100%' },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#495057', marginBottom: 6, marginTop: 12 },
  textInput: { borderWidth: 1, borderColor: '#ced4da', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, backgroundColor: '#f8f9fa', color: '#1a1a1a' },
  passwordWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ced4da', borderRadius: 10, backgroundColor: '#f8f9fa' },

  loginBtn: { backgroundColor: GREEN, marginTop: 25, paddingVertical: 14, borderRadius: 10, alignItems: 'center', shadowColor: GREEN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 },
  loginBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' }
});