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
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing } from '../../src/theme/tokens';
import { useChatHistory, useSendChatMessage, useClearChat, useSubscription } from '../../src/api/queries';
import { router } from 'expo-router';
import { Send, Trash2, Bot, Sparkles, MessageCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { ChatMessage } from '../../src/api/hisaabApi';

const SUGGESTIONS = [
  'If I eat a slice of cake, how much loss is that?',
  'I have 400 kcal left. What should I eat for dinner?',
  'How is my day looking?',
  'How do I get more protein on a veg diet?',
];

export default function CoachScreen() {
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const { data: historyData, isLoading, refetch } = useChatHistory();
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
    Alert.alert('Clear chat', 'Delete your whole chat history?', [
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
        <View style={styles.avatarRow}>
          <View style={styles.avatarBox}>
            <Bot size={22} color={colors.accent} />
          </View>
          <View>
            <View style={styles.nameRow}>
              <Text style={styles.coachTitle}>Coach</Text>
              <View style={styles.aiBadge}>
                <Sparkles size={10} color={colors.accent} />
                <Text style={styles.aiBadgeText}>AI Coach</Text>
              </View>
            </View>
            <Text style={styles.onlineStatus}>Knows your numbers for today</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {showQuota && (
            <View style={styles.quotaPill}>
              <Text style={styles.quotaText}>{chatsRemaining} free left</Text>
            </View>
          )}
          {messages.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={handleClearHistory}>
              <Trash2 size={18} color={colors.textMute} />
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
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <MessageCircle size={36} color={colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>Ask your coach anything</Text>
            <Text style={styles.emptySub}>
              Your calorie balance, meal ideas, or what a cheat meal will cost you.
            </Text>

            {/* Suggestions Chips */}
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionHeader}>TRY ASKING:</Text>
              {SUGGESTIONS.map((s, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.suggestionCard}
                  onPress={() => handleSend(s)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionText}>"{s}"</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            renderItem={({ item }) => {
              const isUser = item.role === 'user';
              return (
                <View style={[styles.bubbleWrapper, isUser ? styles.bubbleUserWrapper : styles.bubbleBhaiWrapper]}>
                  {!isUser && (
                    <View style={styles.bubbleAvatar}>
                      <Bot size={14} color={colors.accent} />
                    </View>
                  )}
                  <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBhai]}>
                    <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextBhai]}>
                      {item.text}
                    </Text>
                  </View>
                </View>
              );
            }}
            ListFooterComponent={
              sendMessageMutation.isPending ? (
                <View style={styles.typingContainer}>
                  <View style={styles.bubbleAvatar}>
                    <Bot size={14} color={colors.accent} />
                  </View>
                  <View style={styles.typingBubble}>
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text style={styles.typingText}>Coach is checking your numbers…</Text>
                  </View>
                </View>
              ) : undefined
            }
          />
        )}

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Ask your coach…"
            placeholderTextColor={colors.textMute}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            disabled={!inputText.trim() || sendMessageMutation.isPending}
            onPress={() => handleSend()}
          >
            <Send size={18} color={inputText.trim() ? '#000' : colors.textMute} />
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
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coachTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.pill,
    gap: 3,
  },
  aiBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.accent,
  },
  onlineStatus: {
    fontSize: 12,
    color: colors.textDim,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quotaPill: {
    backgroundColor: colors.cardAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  quotaText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
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
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  emptySub: {
    fontSize: 14,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  suggestionsContainer: {
    width: '100%',
    gap: 8,
  },
  suggestionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMute,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  suggestionCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  suggestionText: {
    fontSize: 13,
    color: colors.text,
    fontStyle: 'italic',
  },
  messagesList: {
    padding: spacing.xl,
    paddingBottom: 20,
    gap: 14,
  },
  bubbleWrapper: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  bubbleUserWrapper: {
    justifyContent: 'flex-end',
  },
  bubbleBhaiWrapper: {
    justifyContent: 'flex-start',
  },
  bubbleAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: colors.profit,
    borderBottomRightRadius: 4,
  },
  bubbleBhai: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: '#000',
    fontWeight: '500',
  },
  bubbleTextBhai: {
    color: colors.text,
  },
  typingContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.cardAlt,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  typingText: {
    fontSize: 13,
    color: colors.accent,
    fontStyle: 'italic',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.cardAlt,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.cardAlt,
  },
});
