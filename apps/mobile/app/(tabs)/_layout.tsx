// Tab layout for the authed area. Uses simple text glyph icons (no icon font
// dependency) so the app runs without bundling vector-icon assets.
import React from 'react';
import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { colors } from '@/lib/theme';

function TabIcon({ glyph, color }: { glyph: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{glyph}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { color: colors.text, fontWeight: '800' },
        headerTintColor: colors.green,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarLabel: 'Today',
          tabBarIcon: ({ color }) => <TabIcon glyph="☀" color={color} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add meal',
          tabBarLabel: 'Add',
          tabBarIcon: ({ color }) => <TabIcon glyph="＋" color={color} />,
        }}
      />
      <Tabs.Screen
        name="snap"
        options={{
          title: 'Snap a meal',
          tabBarLabel: 'Snap',
          tabBarIcon: ({ color }) => <TabIcon glyph="◉" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarLabel: 'History',
          tabBarIcon: ({ color }) => <TabIcon glyph="▦" color={color} />,
        }}
      />
    </Tabs>
  );
}
