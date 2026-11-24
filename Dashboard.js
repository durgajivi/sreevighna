import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
  Dimensions,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get("window");

const GREEN = "#187A33";
const LIGHT_GREEN = "#f0f7f0";

export default function Dashboard({ navigation, route }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [userData, setUserData] = useState(route?.params?.userData || route?.params?.user || {});

  // Accordion state for collapsible drawer dropdowns
  const [openDropdown, setOpenDropdown] = useState(null);

  useEffect(() => {
    const loadSession = async () => {
      if (!userData || !userData.username) {
        try {
          const storedSession = await SecureStore.getItemAsync('user_session');
          if (storedSession) {
            setUserData(JSON.parse(storedSession));
          }
        } catch (error) {
          console.error("Failed to load session:", error);
        }
      }
    };
    loadSession();
  }, []);

  const goTo = (screen, params = {}) => {
    setMenuOpen(false);
    if (navigation?.navigate) {
      navigation.navigate(screen, {
        ...params,
        userData: userData,
      });
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

  const bottomActions = [
    { label: "Customer", icon: "account-group-outline", screen: "CustomerScreen" },
    { label: "Product", icon: "package-variant-closed", screen: "Products" },
    { label: "Purchase", icon: "cart-arrow-down", screen: "Purchase" },
    { label: "Sales", icon: "file-document-outline", screen: "Sales" },
    { label: "Payment", icon: "cash-multiple", screen: "Payment" },
  ];

  const quickActions = [
    { title: "Sale Invoice", subtitle: "Create new sale", icon: "file-document-outline", screen: "Sales" },
    { title: "Purchase Invoice", subtitle: "Record purchase", icon: "cart-plus", screen: "Purchase" },
    { title: "Add Customer", subtitle: "New customer/vendor", icon: "account-plus-outline", screen: "CustomerScreen" },
    { title: "Add Product", subtitle: "Create new item/service", icon: "package-variant-plus", screen: "Products" },
    { title: "Add Company", subtitle: "Manage product companies", icon: "domain", screen: "CompanyScreen" },
    { title: "Add Category", subtitle: "Manage product categories", icon: "folder-plus-outline", screen: "CategoryScreen" },
    { title: "Payment", subtitle: "Record payment", icon: "cash-plus", screen: "Payment" },
  ];

  const getInitials = () => {
    const name = userData.full_name || userData.username || 'V';
    return name.charAt(0).toUpperCase();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar backgroundColor={GREEN} barStyle="light-content" />

      <View style={styles.container}>
        {/* ================= TOP BAR ================= */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.menuButton} onPress={() => setMenuOpen(true)}>
            <Ionicons name="menu" size={27} color="#fff" />
          </TouchableOpacity>

          <View style={styles.brandContainer}>
            <MaterialCommunityIcons name="heartbeat" size={22} color="#fff" />
            <View style={{ marginLeft: 6 }}>
              <Text style={styles.brandText} numberOfLines={1}>
                {userData.firm_name || "Vagdanam Bill-Soft"}
              </Text>
              <Text style={styles.brandSubText}>
                ID: {userData.user_code || userData.id || 'N/A'}
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

        {/* ================= CONTENT ================= */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeText}>
              Welcome back, {userData.full_name || userData.username || 'User'} 👋
            </Text>
            <Text style={styles.dashboardTitle}>Dashboard</Text>
            <Text style={styles.dashboardSubtitle}>
              {userData.firm_name
                ? `Managing ${userData.firm_name}`
                : "Manage your business quickly and easily."}
            </Text>
          </View>

          {/* Summary Cards */}
          <View style={styles.summaryGrid}>
            <SummaryCard icon="file-document-outline" title="Sales" value="₹0.00" subtitle="This Month" />
            <SummaryCard icon="cart-outline" title="Purchase" value="₹0.00" subtitle="This Month" />
            <SummaryCard icon="cash-check" title="Received" value="₹0.00" subtitle="This Month" />
            <SummaryCard icon="cash-minus" title="Expenses" value="₹0.00" subtitle="This Month" />
          </View>

          {/* Quick Actions */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <Text style={styles.sectionSubtitle}>Frequently used actions</Text>
          </View>

          <View style={styles.quickGrid}>
            {quickActions.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.quickCard}
                activeOpacity={0.75}
                onPress={() => goTo(item.screen, { user: userData })}
              >
                <View style={styles.quickIcon}>
                  <MaterialCommunityIcons name={item.icon} size={26} color={GREEN} />
                </View>
                <View style={styles.quickTextContainer}>
                  <Text style={styles.quickTitle}>{item.title}</Text>
                  <Text style={styles.quickSubtitle}>{item.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#adb5bd" />
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* ================= BOTTOM NAVIGATION ================= */}
        <View style={styles.bottomNavigation}>
          {bottomActions.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.bottomItem}
              activeOpacity={0.7}
              onPress={() => goTo(item.screen, { user: userData })}
            >
              <View style={styles.bottomIconContainer}>
                <MaterialCommunityIcons name={item.icon} size={23} color={GREEN} />
              </View>
              <Text style={styles.bottomLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ================= HAMBURGER DRAWER MENU ================= */}
        {menuOpen && (
          <View style={styles.menuOverlay}>
            <TouchableOpacity
              style={styles.overlayBackground}
              activeOpacity={1}
              onPress={() => setMenuOpen(false)}
            />

            <View style={styles.drawer}>
              {/* Drawer Header */}
              <View style={styles.drawerHeader}>
                <View style={styles.drawerBrandIcon}>
                  <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>
                    {getInitials()}
                  </Text>
                </View>
                <View style={styles.drawerBrandTextContainer}>
                  <Text style={styles.drawerTitle} numberOfLines={1}>
                    {userData.firm_name || userData.full_name || "Vagdanam Soft"}
                  </Text>
                  <Text style={styles.drawerSubtitle}>
                    User ID: {userData.user_code || userData.id || 'N/A'} | Role: {userData.role || 'User'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setMenuOpen(false)}>
                  <Ionicons name="close" size={25} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Drawer Scrollable Navigation Links */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
              >
                <MenuItem
                  icon="view-dashboard-outline"
                  title="Dashboard"
                  shortcut="h"
                  onPress={() => goTo("Dashboard")}
                  active
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
                      onPress={() => goTo("CustomerScreen")}
                    />
                    <MenuSubItem
                      title="Customer / Vendor Group"
                      onPress={() => goTo("CustomerGroup")}
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
                    <MenuSubItem title="Company Name" onPress={() => goTo("CompanyScreen")} />
                    <MenuSubItem title="Category" onPress={() => goTo("CategoryScreen")} />
                    <MenuSubItem title="Products" shortcut="i" onPress={() => goTo("Products")} />
                    <MenuSubItem title="Stock" onPress={() => goTo("Stock")} />
                  </View>
                )}

                <MenuItem
                  icon="file-document-outline"
                  title="Sale Invoice"
                  shortcut="s"
                  onPress={() => goTo("Sales")}
                />
                <MenuItem
                  icon="file-document-edit-outline"
                  title="Purchase Invoice"
                  shortcut="p"
                  onPress={() => goTo("Purchase")}
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
                      onPress={() => goTo("Payment", { type: 'inward' })}
                    />
                    <MenuSubItem
                      title="Outward Payment (Purchase)"
                      shortcut="g"
                      onPress={() => goTo("Payment", { type: 'outward' })}
                    />
                  </View>
                )}

                <MenuDivider />
                <MenuItem icon="logout" title="Logout" onPress={handleLogout} />
              </ScrollView>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

/* ========================================================
   SUB-COMPONENTS
   ======================================================== */
function SummaryCard({ icon, title, value, subtitle }) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryTop}>
        <View style={styles.summaryIcon}>
          <MaterialCommunityIcons name={icon} size={23} color={GREEN} />
        </View>
        <Text style={styles.summaryTitle}>{title}</Text>
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summarySubtitle}>{subtitle}</Text>
    </View>
  );
}

function MenuItem({ icon, title, shortcut, onPress, active = false }) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, active && styles.menuItemActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons name={icon} size={20} color={active ? GREEN : "#555"} />
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
      <Ionicons
        name={isOpen ? "chevron-down" : "chevron-forward"}
        size={16}
        color="#adb5bd"
      />
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

/* ========================================================
   STYLES
   ======================================================== */
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: GREEN },
  container: { flex: 1, backgroundColor: "#f8f9fa" },

  // ---- Top bar (fixed: no manual StatusBar padding) ----
  topBar: {
    minHeight: 58,
    backgroundColor: GREEN,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  menuButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  brandContainer: { flex: 1, flexDirection: "row", alignItems: "center", marginLeft: 5 },
  brandText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  brandSubText: { color: "#b7dfbe", fontSize: 10, fontWeight: "500" },
  topActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: GREEN, fontSize: 14, fontWeight: "800" },

  content: { flex: 1 },
  contentContainer: { padding: 16 },

  welcomeSection: { marginBottom: 18 },
  welcomeText: { fontSize: 13, color: "#868e96", marginBottom: 3 },
  dashboardTitle: { fontSize: 26, fontWeight: "800", color: "#1a1a1a" },
  dashboardSubtitle: { fontSize: 13, color: "#868e96", marginTop: 3 },

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 25,
  },
  summaryCard: {
    width: (width - 44) / 2,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#edf0f2",
    elevation: 2,
  },
  summaryTop: { flexDirection: "row", alignItems: "center" },
  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: LIGHT_GREEN,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },
  summaryTitle: { fontSize: 12, color: "#6c757d", fontWeight: "600" },
  summaryValue: { fontSize: 19, fontWeight: "800", color: "#212529", marginTop: 12 },
  summarySubtitle: { fontSize: 10, color: "#adb5bd", marginTop: 3 },

  sectionHeader: { marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#212529" },
  sectionSubtitle: { fontSize: 11, color: "#868e96", marginTop: 2 },

  quickGrid: { marginBottom: 22 },
  quickCard: {
    backgroundColor: "#fff",
    borderRadius: 11,
    padding: 13,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#edf0f2",
  },
  quickIcon: {
    width: 45,
    height: 45,
    borderRadius: 11,
    backgroundColor: LIGHT_GREEN,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  quickTextContainer: { flex: 1 },
  quickTitle: { fontSize: 14, fontWeight: "700", color: "#212529" },
  quickSubtitle: { fontSize: 11, color: "#868e96", marginTop: 2 },

  bottomNavigation: {
    height: Platform.OS === "ios" ? 78 : 68,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e9ecef",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingBottom: Platform.OS === "ios" ? 10 : 0,
    elevation: 15,
  },
  bottomItem: { flex: 1, alignItems: "center", justifyContent: "center" },
  bottomIconContainer: {
    width: 36,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomLabel: { fontSize: 10, color: "#495057", fontWeight: "600", marginTop: 1 },

  menuOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    zIndex: 1000,
  },
  overlayBackground: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: Math.min(width * 0.84, 330),
    backgroundColor: "#fff",
    elevation: 20,
  },

  // ---- Drawer header (fixed: no Platform-specific padding) ----
  drawerHeader: {
    backgroundColor: GREEN,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "center",
  },
  drawerBrandIcon: {
    width: 43,
    height: 43,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  drawerBrandTextContainer: { flex: 1, marginLeft: 10 },
  drawerTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  drawerSubtitle: { color: "#b7dfbe", fontSize: 10, marginTop: 2 },

  menuItem: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f3f5",
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
    color: "#495057",
    fontWeight: "500",
  },
  menuItemTextActive: { color: GREEN, fontWeight: "700" },

  menuSection: {
    minHeight: 47,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    backgroundColor: "#fafcfb",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f3f5",
  },
  menuSectionText: {
    flex: 1,
    marginLeft: 13,
    fontSize: 13,
    color: "#343a40",
    fontWeight: "700",
  },
  dropdownContainer: { backgroundColor: "#f8f9fa", paddingVertical: 2 },
  menuSubItem: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 46,
    paddingRight: 18,
  },
  subDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#adb5bd",
    marginRight: 11,
  },
  menuSubText: { flex: 1, fontSize: 12, color: "#6c757d" },
  shortcutKey: {
    fontSize: 10,
    backgroundColor: "#e9ecef",
    color: "#495057",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
    overflow: 'hidden',
    fontWeight: "600",
  },
  menuDivider: { height: 1, backgroundColor: "#e9ecef", marginVertical: 6 },
});