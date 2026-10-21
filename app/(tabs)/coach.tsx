import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii } from '../../src/theme/tokens';
import { font } from '../../src/theme/fonts';
import { useChatHistory, useSendChatMessage, useClearChat, useSubscription } from '../../src/api/queries';
import { router } from 'expo-router';
import { ArrowUp, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { ChatMessage } from '../../src/api/hisaabApi';

const SUGGESTIONS = [
  'If I eat a slice of cake, how much loss is that?',
  'I have 400 kcal left. What should I eat for dinner?',
  'How is my day looking?',
  'How do I get more protein on a veg diet?',
];

export default function CoachScreen() {
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const { data: historyData, isLoading } = useChatHistory();
  const { data: subData } = useSubscription();
  const sendMessageMutation = useSendChatMessage();
  const clearChatMutation = useClearChat();

  const messages: ChatMessage[] = historyData?.messages || [];

  const chatsUsed = subData?.usage?.chats?.used ?? 0;
  const chatsLimit = subData?.usage?.chats?.limit ?? 5;
  const isPro = subData?.isPro ?? false;
  const chatsRemaining = Math.max(0, chatsLimit - chatsUsed);
  const showQuota = !isPro && subData?.usage?.limitsEnabled === true;

  const handleSend = (textToSend?: string) => {
    const text = (textToSend ?? inputText).trim();
    if (!text) return;

    setInputText('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    sendMessageMutation.mutate(text, {
      onError: (err: any) => {
        if (err?.code === 'PAYWALL_LIMIT' || err?.status === 402) {
          router.push({
            pathname: '/paywall',
            params: { reason: err?.message || 'You’ve used today’s free coach chats. Upgrade to keep chatting.' },
          } as any);
        } else {
          Alert.alert('Coach is unavailable', err?.message || 'Try again in a minute.');
        }
      },
    });
  };

  const handleClearHistory = () => {
    Alert.alert('Clear chat', 'Delete your entire chat history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => clearChatMutation.mutate(),
      },
    ]);
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, sendMessageMutation.isPending]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Coach</Text>
          <Text style={styles.headerSub}>Knows your numbers for today</Text>
        </View>

        <View style={styles.headerRight}>
          {showQuota && (
            <View style={styles.quotaPill}>
              <Text style={styles.quotaText}>{chatsRemaining} free chats left</Text>
            </View>
          )}
          {messages.length > 0 && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={handleClearHistory}
              accessibilityLabel="Clear chat"
            >
              <Trash2 size={18} color={colors.textDim} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={{ flex: 1 }}
      >
        {isLoading && !historyData ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator color={colors.textDim} size="large" />
          </View>
        ) : messages.length === 0 ? (
          /* Empty State: title + 4 tappable suggestions */
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Ask your coach anything</Text>
            <View style={styles.suggestionsList}>
              {SUGGESTIONS.map((s, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.suggestionRow}
                  onPress={() => handleSend(s)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          /* Message List */
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesContainer}
            renderItem={({ item }) => {
              const isUser = item.role === 'user';
              if (isUser) {
                return (
                  <View style={styles.userBubbleWrap}>
                    <View style={styles.userBubble}>
                      <Text style={styles.userText}>{item.text}</Text>
                    </View>
                  </View>
                );
              }
              // Coach messages: no bubble background, plain white text
              return (
                <View style={styles.coachWrap}>
                  <Text style={styles.coachText}>{item.text}</Text>
                </View>
              );
            }}
            ListFooterComponent={
              sendMessageMutation.isPending ? (
                <View style={styles.typingWrap}>
                  <Text style={styles.typingText}>Coach is checking your numbers…</Text>
                </View>
              ) : null
            }
          />
        )}

        {/* Input Bar pinned above the keyboard */}
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            style={styles.inputField}
            placeholder="Ask your coach…"
            placeholderTextColor={colors.textMute}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            selectionColor="#FFFFFF"
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            disabled={!inputText.trim() || sendMessageMutation.isPending}
            onPress={() => handleSend()}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <ArrowUp size={20} color="#000000" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontFamily: font.bold,
    fontSize: 28,
    color: colors.text,
    letterSpacing: -0.6,
  },
  headerSub: {
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.textDim,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quotaPill: {
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  quotaText: {
    fontFamily: font.medium,
    fontSize: 12,
    color: colors.textDim,
  },
  clearBtn: {
    padding: 6,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    gap: 20,
  },
  emptyTitle: {
    fontFamily: font.semibold,
    fontSize: 22,
    color: colors.text,
    letterSpacing: -0.4,
  },
  suggestionsList: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  suggestionText: {
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
    letterSpacing: -0.2,
  },
  messagesContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  userBubbleWrap: {
    alignItems: 'flex-end',
  },
  userBubble: {
    backgroundColor: colors.control,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '82%',
  },
  userText: {
    fontFamily: font.regular,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
    letterSpacing: -0.2,
  },
  coachWrap: {
    alignItems: 'flex-start',
    maxWidth: '92%',
  },
  coachText: {
    fontFamily: font.regular,
    fontSize: 16,
    lineHeight: 23,
    color: colors.text,
    letterSpacing: -0.2,
  },
  typingWrap: {
    paddingVertical: 8,
  },
  typingText: {
    fontFamily: font.medium,
    fontSize: 14,
    color: colors.textDim,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 10,
  },
  inputField: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.text,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.3,
  },
});
