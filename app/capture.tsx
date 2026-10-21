import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { colors, radii, spacing } from '../src/theme/tokens';
import { router } from 'expo-router';
import { X, Camera as CameraIcon, Image as ImageIcon, Barcode, MessageSquare, FlipHorizontal, Zap, ZapOff, Check, Plus, Minus } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCreateMeal } from '../src/api/queries';
import { api } from '../src/api/client';
import type { BarcodeProduct, MealType } from '../src/api/hisaabApi';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type CaptureMode = 'snap' | 'barcode' | 'describe';

/** Same slots the server uses when it infers the meal type. */
function mealTypeNow(): MealType {
  const h = new Date().getHours();
  if (h >= 4 && h < 11) return 'breakfast';
  if (h >= 11 && h < 16) return 'lunch';
  if (h >= 16 && h < 19) return 'snack';
  return 'dinner';
}

export default function CaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<CaptureMode>('snap');
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<boolean>(false);
  const cameraRef = useRef<CameraView>(null);

  // Describe state
  const [description, setDescription] = useState('');
  const [selectedMealType, setSelectedMealType] = useState<MealType>(mealTypeNow);
  const [isAnalyzingDescription, setIsAnalyzingDescription] = useState(false);

  // Barcode state
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [scannedProduct, setScannedProduct] = useState<BarcodeProduct | null>(null);
  const [barcodeServings, setBarcodeServings] = useState<number>(1);
  const [isLookingUpBarcode, setIsLookingUpBarcode] = useState(false);
  const [barcodeNotFound, setBarcodeNotFound] = useState(false);

  const createMealMutation = useCreateMeal();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const askedPermission = useRef(false);

  useEffect(() => {
    // Ask once; if the user denied, the fallback screen below has a button.
    if (permission && !permission.granted && permission.canAskAgain && !askedPermission.current) {
      askedPermission.current = true;
      requestPermission();
    }
  }, [permission]);

  // Handle Snap & Upload (< 3s loop)
  const processAndUploadImage = async (uri: string, width?: number, height?: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // 1. Resize with expo-image-manipulator to max 1024px long edge, JPEG quality 0.7
      const targetSize = 1024;
      const actions = [];
      if (width && height) {
        if (width >= height && width > targetSize) {
          actions.push({ resize: { width: targetSize } });
        } else if (height > width && height > targetSize) {
          actions.push({ resize: { height: targetSize } });
        }
      } else {
        actions.push({ resize: { width: targetSize } });
      }

      const manipResult = await manipulateAsync(uri, actions, {
        compress: 0.7,
        format: SaveFormat.JPEG,
        base64: true,
      });
      if (!manipResult.base64) throw new Error('Image encoding failed');

      // 2. Fire the upload without awaiting. This screen unmounts right below, so the
      //    handlers are plain promise callbacks (mutate() callbacks are dropped on unmount).
      //    mealType is omitted on purpose: the server infers it from the time of day.
      //    Sent as base64 JSON, not multipart: Expo replaces global fetch on native, and its
      //    FormData only accepts Blob/File parts — React Native's { uri } parts throw
      //    "Unsupported FormDataPart implementation".
      api.meals
        .analyze({ imageBase64: manipResult.base64, mimeType: 'image/jpeg' })
        .then(() => queryClient.invalidateQueries({ queryKey: ['dashboard'] }))
        .catch((err: any) => {
          if (err?.code === 'PAYWALL_LIMIT' || err?.status === 402) {
            router.push({ pathname: '/paywall', params: { reason: err.message } } as any);
          } else {
            Alert.alert('Couldn’t upload photo', err?.message || 'Check your connection and try again.');
          }
        });

      // 3. Close camera immediately so user sees the skeleton card on Home
      router.back();
    } catch (err: any) {
      console.error('[Capture] error processing image:', err);
      Alert.alert('Error', 'Photo capture failed. Try again.');
    }
  };

  const handleCapturePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      // No skipProcessing: on many Android phones (e.g. Samsung) it returns sideways photos,
      // and the thumbnail would show rotated. We re-encode to 1024px anyway, so quality 0.8 is plenty.
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        await processAndUploadImage(photo.uri, photo.width, photo.height);
      }
    } catch (err) {
      console.warn('[Capture] takePictureAsync failed:', err);
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await processAndUploadImage(asset.uri, asset.width, asset.height);
      }
    } catch (err) {
      console.warn('[Capture] gallery picker failed:', err);
    }
  };

  // Handle Describe flow
  const handleAnalyzeDescription = async () => {
    if (!description.trim()) return;
    setIsAnalyzingDescription(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const res = await api.meals.analyze(
        {
          description: description.trim(),
          mealType: selectedMealType,
        },
        { wait: true }
      );
      setIsAnalyzingDescription(false);
      // Open review sheet for this meal
      router.replace(`/meal/${res.meal.id}` as any);
    } catch (err: any) {
      setIsAnalyzingDescription(false);
      if (err?.code === 'PAYWALL_LIMIT' || err?.status === 402) {
        router.push('/paywall' as any);
      } else {
        Alert.alert('Analysis error', err?.message || 'Failed to analyze description.');
      }
    }
  };

  // Handle Barcode scanning
  const handleBarcodeScanned = async (scanResult: BarcodeScanningResult) => {
    if (scannedBarcode || isLookingUpBarcode) return;
    const code = scanResult.data;
    setScannedBarcode(code);
    setIsLookingUpBarcode(true);
    setBarcodeNotFound(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const res = await api.food.barcode(code);
      setScannedProduct(res.product);
      setBarcodeServings(1);
    } catch (err: any) {
      if (err?.status === 404 || err?.code === 'NOT_FOUND') {
        setBarcodeNotFound(true);
      } else {
        setScannedBarcode(null); // unlock the scanner so the user can try again
        Alert.alert('Barcode lookup', err?.message || 'Lookup failed');
      }
    } finally {
      setIsLookingUpBarcode(false);
    }
  };

  const handleLogBarcodeProduct = () => {
    if (!scannedProduct) return;
    createMealMutation.mutate(
      {
        dishName: scannedProduct.name,
        calories: scannedProduct.calories,
        proteinG: scannedProduct.proteinG,
        carbsG: scannedProduct.carbsG,
        fatG: scannedProduct.fatG,
        fiberG: scannedProduct.fiberG,
        source: 'barcode',
        mealType: selectedMealType,
        servings: barcodeServings,
      },
      {
        onSuccess: (data) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.replace(`/meal/${data.meal.id}` as any);
        },
        onError: (err: any) => Alert.alert('Couldn’t log meal', err?.message || 'Try again.'),
      }
    );
  };

  // Describe mode needs no camera — never lock the user out of logging food.
  if (!permission?.granted && mode !== 'describe') {
    return (
      <View style={styles.permissionContainer}>
        <CameraIcon size={48} color={colors.accent} />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionSub}>
          Hisaab needs camera access to instantly scan your meals and calculate calories.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Enable Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closePermissionBtn} onPress={() => setMode('describe')}>
          <Text style={[styles.closePermissionBtnText, { color: colors.accent }]}>Describe meal instead</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closePermissionBtn} onPress={() => router.back()}>
          <Text style={styles.closePermissionBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()}>
          <X size={22} color={colors.text} />
        </TouchableOpacity>

        {mode === 'snap' && (
          <View style={styles.topActions}>
            <TouchableOpacity style={styles.topBtn} onPress={() => setFlash(!flash)}>
              {flash ? <Zap size={22} color={colors.accent} /> : <ZapOff size={22} color={colors.textDim} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.topBtn}
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            >
              <FlipHorizontal size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Main Viewport */}
      {mode === 'describe' ? (
        <View style={styles.describeContainer}>
          <Text style={styles.describeHeader}>Describe your meal</Text>
          <Text style={styles.describeSub}>Write it the way you’d say it. Quantities help.</Text>

          <TextInput
            style={styles.describeInput}
            multiline
            numberOfLines={4}
            placeholder="e.g. 2 idlis, sambar and a filter coffee"
            placeholderTextColor={colors.textMute}
            value={description}
            onChangeText={setDescription}
            autoFocus
          />

          <Text style={styles.mealTypeLabel}>MEAL TYPE</Text>
          <View style={styles.mealTypeRow}>
            {(['breakfast', 'lunch', 'snack', 'dinner'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.mealTypeChip, selectedMealType === t && styles.mealTypeChipActive]}
                onPress={() => setSelectedMealType(t)}
              >
                <Text
                  style={[styles.mealTypeText, selectedMealType === t && styles.mealTypeTextActive]}
                >
                  {t.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.analyzeBtn}
            onPress={handleAnalyzeDescription}
            disabled={isAnalyzingDescription || !description.trim()}
          >
            {isAnalyzingDescription ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.analyzeBtnText}>Analyze Meal</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.cameraWrapper}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            enableTorch={flash}
            barcodeScannerSettings={
              mode === 'barcode'
                ? {
                    // Food packaging only — the server accepts 6–14 digit codes
                    barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
                  }
                : undefined
            }
            onBarcodeScanned={mode === 'barcode' ? handleBarcodeScanned : undefined}
          />

          {mode === 'barcode' && (
            <View style={styles.barcodeOverlay}>
              <View style={styles.barcodeTargetBox}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              <Text style={styles.barcodeGuideText}>Point camera at the barcode on packaged food</Text>
            </View>
          )}

          {/* Barcode scanning result sheet */}
          {scannedProduct && (
            <View style={styles.productSheet}>
              <View style={styles.productSheetHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>{scannedProduct.name}</Text>
                  {scannedProduct.brand && <Text style={styles.productBrand}>{scannedProduct.brand}</Text>}
                </View>
                <TouchableOpacity onPress={() => { setScannedProduct(null); setScannedBarcode(null); }}>
                  <X size={20} color={colors.textDim} />
                </TouchableOpacity>
              </View>

              <View style={styles.productNutritionRow}>
                <Text style={styles.productCalText}>
                  {Math.round(scannedProduct.calories * barcodeServings)} kcal
                </Text>
                <Text style={styles.productServingLabel}>
                  ({scannedProduct.servingLabel} × {barcodeServings})
                </Text>
              </View>

              {/* Stepper */}
              <View style={styles.servingStepperRow}>
                <Text style={styles.stepperLabel}>Servings:</Text>
                <View style={styles.stepperControls}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setBarcodeServings((s) => Math.max(0.5, s - 0.5))}
                  >
                    <Minus size={16} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{barcodeServings}x</Text>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setBarcodeServings((s) => s + 0.5)}
                  >
                    <Plus size={16} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.logBarcodeBtn}
                onPress={handleLogBarcodeProduct}
                disabled={createMealMutation.isPending}
              >
                {createMealMutation.isPending ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={styles.logBarcodeBtnText}>Add to Hisaab</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {barcodeNotFound && (
            <View style={styles.notFoundSheet}>
              <Text style={styles.notFoundTitle}>We couldn’t find this product. Try a photo instead.</Text>
              <TouchableOpacity
                style={styles.switchModeBtn}
                onPress={() => {
                  setBarcodeNotFound(false);
                  setScannedBarcode(null);
                  setMode('snap');
                }}
              >
                <CameraIcon size={16} color="#000" />
                <Text style={styles.switchModeBtnText}>Snap photo instead</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Bottom Mode Switcher & Shutter */}
      <View style={[styles.bottomControlsContainer, { bottom: insets.bottom + 20 }]}>
        {/* Mode Selector */}
        <View style={styles.modeTabs}>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'snap' && styles.modeTabActive]}
            onPress={() => setMode('snap')}
          >
            <Text style={[styles.modeTabText, mode === 'snap' && styles.modeTabTextActive]}>Snap</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'barcode' && styles.modeTabActive]}
            onPress={() => setMode('barcode')}
          >
            <Text style={[styles.modeTabText, mode === 'barcode' && styles.modeTabTextActive]}>
              Barcode
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'describe' && styles.modeTabActive]}
            onPress={() => setMode('describe')}
          >
            <Text style={[styles.modeTabText, mode === 'describe' && styles.modeTabTextActive]}>
              Describe
            </Text>
          </TouchableOpacity>
        </View>

        {/* Shutter Row for Snap mode */}
        {mode === 'snap' && (
          <View style={styles.shutterRow}>
            <TouchableOpacity style={styles.sideControlBtn} onPress={handlePickFromGallery}>
              <ImageIcon size={26} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shutterBtnOuter}
              activeOpacity={0.8}
              onPress={handleCapturePhoto}
            >
              <View style={styles.shutterBtnInner} />
            </TouchableOpacity>

            <View style={{ width: 44 }} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraWrapper: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  topActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  topBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomControlsContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: spacing.lg,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: radii.pill,
    padding: 4,
    gap: 4,
  },
  modeTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  modeTabActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDim,
  },
  modeTabTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: spacing.xxl,
  },
  sideControlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  shutterBtnOuter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 4,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  shutterBtnInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.text,
  },
  // Describe mode
  describeContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: 100,
    paddingHorizontal: spacing.xl,
  },
  describeHeader: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  describeSub: {
    fontSize: 14,
    color: colors.textDim,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  describeInput: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.lg,
    color: colors.text,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  mealTypeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMute,
    letterSpacing: 0.8,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  mealTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  mealTypeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.button,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  mealTypeChipActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  mealTypeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMute,
  },
  mealTypeTextActive: {
    color: colors.accent,
  },
  analyzeBtn: {
    backgroundColor: colors.profit,
    borderRadius: radii.button,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  analyzeBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
  },
  // Barcode overlay
  barcodeOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barcodeTargetBox: {
    width: 250,
    height: 160,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: colors.profit,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  barcodeGuideText: {
    color: colors.text,
    fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    marginTop: 20,
    fontWeight: '500',
  },
  productSheet: {
    position: 'absolute',
    bottom: 120,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  productName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  productBrand: {
    fontSize: 13,
    color: colors.textDim,
    marginTop: 2,
  },
  productNutritionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginVertical: spacing.md,
  },
  productCalText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  productServingLabel: {
    fontSize: 13,
    color: colors.textMute,
  },
  servingStepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  stepperLabel: {
    fontSize: 14,
    color: colors.textDim,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  logBarcodeBtn: {
    backgroundColor: colors.profit,
    borderRadius: radii.button,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logBarcodeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  notFoundSheet: {
    position: 'absolute',
    bottom: 120,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.loss,
    gap: 12,
  },
  notFoundTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  switchModeBtn: {
    backgroundColor: colors.profit,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.button,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  switchModeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
  },
  // Permission
  permissionContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.lg,
  },
  permissionSub: {
    fontSize: 14,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  permissionBtn: {
    backgroundColor: colors.profit,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: radii.button,
    width: '100%',
    alignItems: 'center',
  },
  permissionBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
  },
  closePermissionBtn: {
    marginTop: spacing.md,
    padding: spacing.md,
  },
  closePermissionBtnText: {
    fontSize: 14,
    color: colors.textMute,
    fontWeight: '600',
  },
});
