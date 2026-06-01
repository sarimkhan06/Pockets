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

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HomeStack({ onRefreshInboxCount }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="PocketDetail" component={PocketDetailScreen} />
      <Stack.Screen name="AddPocket" component={AddPocketScreen} />
      <Stack.Screen name="EditPocket">
        {(props) => <EditPocketScreen {...props} onRefreshInboxCount={onRefreshInboxCount} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function SettingsStack({ onLogout, onRetakeQuiz, userName, currentMethod, onRestoreComplete }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
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
      <Stack.Screen name="SwitchMethod">
        {(props) => (
          <SwitchMethodScreen {...props} />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

export default function MainNavigator({ onLogout, onRetakeQuiz, userName, currentMethod, inboxCount, onRefreshInboxCount, onRestoreComplete }) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0F1923',
          borderTopColor: 'rgba(255,255,255,0.08)',
          height: 65,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#00D4AA',
        tabBarInactiveTintColor: '#4A5E78',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Home"
        options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏠</Text> }}
      >
        {() => <HomeStack onRefreshInboxCount={onRefreshInboxCount} />}
      </Tab.Screen>
      <Tab.Screen
        name="Inbox"
        options={{
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🔔</Text>,
          tabBarBadge: inboxCount > 0 ? inboxCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#FF5252', fontSize: 11, fontWeight: '700' },
        }}
      >
        {(props) => <InboxScreen {...props} onRefreshInboxCount={onRefreshInboxCount} />}
      </Tab.Screen>
      <Tab.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📋</Text> }}
      />
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
