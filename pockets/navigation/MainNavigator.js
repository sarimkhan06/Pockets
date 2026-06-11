// MainNavigator.js — the bottom-tab navigation structure for the logged-in app.
//
// React Navigation has two main navigator types used here:
//   createBottomTabNavigator → shows the 4-tab bar at the bottom (Home, Inbox, Transactions, Settings)
//   createNativeStackNavigator → allows push/pop navigation within a tab (e.g., Dashboard → PocketDetail)
//
// Structure:
//   Tab.Navigator
//     ├── "Home" tab → HomeStack (Stack with Dashboard, PocketDetail, AddPocket, EditPocket)
//     ├── "Inbox" tab → InboxScreen
//     ├── "Transactions" tab → TransactionsScreen
//     └── "Settings" tab → SettingsStack (Stack with SettingsMain, ConnectBank, MFA, etc.)
//
// Why nested stacks inside tabs?
//   Each tab needs its own navigation history. Putting a Stack inside a Tab means
//   the Home tab can go Dashboard → PocketDetail → EditPocket, and the back button
//   works within that tab without affecting the other tabs.

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';

import DashboardScreen from '../screens/DashboardScreen';
import PocketDetailScreen from '../screens/PocketDetailScreen';
import AddPocketScreen from '../screens/AddPocketScreen';
import EditPocketScreen from '../screens/EditPocketScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import InboxScreen from '../screens/InboxScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ConnectBankScreen from '../screens/ConnectBankScreen';
import SwitchMethodScreen from '../screens/SwitchMethodScreen';
import MFASetupScreen from '../screens/MFASetupScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';

// Create the two navigator instances.
// These are just factory functions — they return navigator components.
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// HomeStack defines the navigation tree for the Home tab.
// headerShown: false hides the default navigation header — we draw our own custom headers.
function HomeStack({ onRefreshInboxCount }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* The first screen listed is the default (what you see when you open the tab) */}
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="PocketDetail" component={PocketDetailScreen} />
      <Stack.Screen name="AddPocket" component={AddPocketScreen} />
      {/* EditPocket uses a render function instead of component={...} because it needs
          to receive a custom prop (onRefreshInboxCount) that isn't part of screen navigation params. */}
      <Stack.Screen name="EditPocket">
        {(props) => <EditPocketScreen {...props} onRefreshInboxCount={onRefreshInboxCount} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

// SettingsStack defines the navigation tree for the Settings tab.
// All of these screens are accessible from SettingsScreen via navigation.navigate('ConnectBank') etc.
function SettingsStack({ onLogout, onRetakeQuiz, userName, currentMethod, onRestoreComplete }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* SettingsMain also uses a render function because it needs multiple custom props */}
      <Stack.Screen name="SettingsMain">
        {(props) => (
          <SettingsScreen
            {...props}
            onLogout={onLogout}
            onRetakeQuiz={onRetakeQuiz}
            userName={userName}
            currentMethod={currentMethod}
            onRestoreComplete={onRestoreComplete}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ConnectBank" component={ConnectBankScreen} />
      <Stack.Screen name="MFASetup" component={MFASetupScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="SwitchMethod">
        {(props) => (
          <SwitchMethodScreen {...props} />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

// MainNavigator is the root component exported from this file.
// It receives props from App.js and threads them down into the nested stacks.
export default function MainNavigator({ onLogout, onRetakeQuiz, userName, currentMethod, inboxCount, onRefreshInboxCount, onRestoreComplete }) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        // Tab bar visual styling
        tabBarStyle: {
          backgroundColor: '#0F1923',
          borderTopColor: 'rgba(255,255,255,0.08)',
          height: 65,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#00D4AA',   // Color when tab is selected
        tabBarInactiveTintColor: '#4A5E78', // Color when tab is not selected
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      {/* Home tab — contains the full HomeStack */}
      <Tab.Screen
        name="Home"
        options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏠</Text> }}
      >
        {/* Render function needed here to pass onRefreshInboxCount into the stack */}
        {() => <HomeStack onRefreshInboxCount={onRefreshInboxCount} />}
      </Tab.Screen>

      {/* Inbox tab — tabBarBadge shows the red number when inboxCount > 0 */}
      <Tab.Screen
        name="Inbox"
        options={{
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🔔</Text>,
          tabBarBadge: inboxCount > 0 ? inboxCount : undefined, // undefined = hide the badge entirely
          tabBarBadgeStyle: { backgroundColor: '#FF5252', fontSize: 11, fontWeight: '700' },
        }}
      >
        {(props) => <InboxScreen {...props} onRefreshInboxCount={onRefreshInboxCount} />}
      </Tab.Screen>

      {/* Transactions tab — simple, no custom props needed */}
      <Tab.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📋</Text> }}
      />

      {/* Settings tab — contains the full SettingsStack with all sub-screens */}
      <Tab.Screen
        name="Settings"
        options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⚙️</Text> }}
      >
        {() => (
          <SettingsStack
            onLogout={onLogout}
            onRetakeQuiz={onRetakeQuiz}
            userName={userName}
            currentMethod={currentMethod}
            onRestoreComplete={onRestoreComplete}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
