import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { colors, radii } from '../src/theme/tokens';
import { font } from '../src/theme/fonts';
import { router } from 'expo-router';
import { X, Image as ImageIcon, Zap, ZapOff, FlipHorizontal, Plus, Minus } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCreateMeal } from '../src/api/queries';
import { api } from '../src/api/client';
import type { BarcodeProduct, MealType } from '../src/api/hisaabApi';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type CaptureMode = 'snap' | 'barcode' | 'describe';

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
    if (permission && !permission.granted && permission.canAskAgain && !askedPermission.current) {
      askedPermission.current = true;
      requestPermission();
    }
  }, [permission]);

  // Handle Snap & Upload (< 3s loop)
  const processAndUploadImage = async (uri: string, width?: number, height?: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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

      // Sent as base64 JSON, not multipart
      api.meals
        .analyze({ imageBase64: manipResult.base64, mimeType: 'image/jpeg' })
        .then(() => queryClient.invalidateQueries({ queryKey: ['dashboard'] }))
        .catch((err: any) => {
          if (err?.code === 'PAYWALL_LIMIT' || err?.status === 402) {
            router.push({ pathname: '/paywall', params: { reason: err.message } } as any);
          } else {
            Alert.alert('Couldn’t upload photo', err?.message || 'Check connection.');
          }
        });

      // Close camera immediately
      router.back();
    } catch (err: any) {
      console.error('[Capture] error processing image:', err);
      Alert.alert('Error', 'Photo capture failed. Try again.');
    }
  };

  const handleCapturePhoto = async () => {
    if (!cameraRef.current) return;
    try {
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
        setScannedBarcode(null);
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

  // Describe mode does not require camera permission
  if (!permission?.granted && mode !== 'describe') {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Camera Access</Text>
        <Text style={styles.permissionSub}>
          Hisaab uses the camera to scan meals and calculate calories.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Enable Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.textBtn} onPress={() => setMode('describe')}>
          <Text style={styles.textBtnText}>Describe meal instead</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.textBtn} onPress={() => router.back()}>
          <Text style={styles.textBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.topCircleBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close camera"
        >
          <X size={22} color="#FFFFFF" strokeWidth={2.4} />
        </TouchableOpacity>

        {mode === 'snap' && (
          <View style={styles.topRightActions}>
            <TouchableOpacity
              style={styles.topCircleBtn}
              onPress={() => setFlash(!flash)}
              accessibilityLabel="Toggle flash"
            >
              {flash ? <Zap size={20} color={colors.accent} /> : <ZapOff size={20} color="#FFFFFF" />}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.topCircleBtn}
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
              accessibilityLabel="Switch camera"
            >
              <FlipHorizontal size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Main Viewport */}
      {mode === 'describe' ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.describeView, { paddingTop: insets.top + 60 }]}
        >
          <Text style={styles.describeTitle}>Describe your meal</Text>
          <Text style={styles.describeSub}>Write it the way you’d say it. Quantities help.</Text>

          <TextInput
            style={styles.describeInput}
            multiline
            placeholder="e.g. 2 rotis, dal tadka and a plate of rice"
            placeholderTextColor={colors.textMute}
            value={description}
            onChangeText={setDescription}
            autoFocus
            selectionColor="#FFFFFF"
          />

          <View style={styles.mealChipsRow}>
            {(['breakfast', 'lunch', 'snack', 'dinner'] as const).map((t) => {
              const on = selectedMealType === t;
              const label = t.charAt(0).toUpperCase() + t.slice(1);
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.mealChip, on && styles.mealChipOn]}
                  onPress={() => setSelectedMealType(t)}
                >
                  <Text style={[styles.mealChipText, on && styles.mealChipTextOn]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ flex: 1 }} />

          {/* Pinned Analyze Meal button */}
          <TouchableOpacity
            style={[styles.analyzeBtn, !description.trim() && styles.analyzeBtnDisabled]}
            disabled={!description.trim() || isAnalyzingDescription}
            onPress={handleAnalyzeDescription}
          >
            {isAnalyzingDescription ? (
              <ActivityIndicator color="#000000" size="small" />
            ) : (
              <Text style={styles.analyzeBtnText}>Analyze Meal</Text>
            )}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      ) : (
        /* Camera Viewport (Snap or Barcode) */
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          enableTorch={flash}
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
          }}
          onBarcodeScanned={mode === 'barcode' ? handleBarcodeScanned : undefined}
        >
          {mode === 'barcode' && (
            <View style={styles.barcodeOverlay}>
              <View style={styles.scanFrame} />
              <Text style={styles.scanHint}>Point at the barcode on the pack</Text>

              {isLookingUpBarcode && (
                <View style={styles.barcodeLoadingBadge}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.barcodeLoadingText}>Looking up product…</Text>
                </View>
              )}

              {barcodeNotFound && (
                <View style={styles.barcodeErrorBadge}>
                  <Text style={styles.barcodeErrorText}>
                    We couldn’t find this product. Try a photo instead.
                  </Text>
                  <TouchableOpacity
                    style={styles.switchModePill}
                    onPress={() => {
                      setBarcodeNotFound(false);
                      setScannedBarcode(null);
                      setMode('snap');
                    }}
                  >
                    <Text style={styles.switchModePillText}>Switch to Photo</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Barcode Result Sheet */}
              {scannedProduct && (
                <View style={styles.barcodeResultSheet}>
                  <Text style={styles.productName}>{scannedProduct.name}</Text>
                  {scannedProduct.brand && (
                    <Text style={styles.productBrand}>{scannedProduct.brand}</Text>
                  )}
                  <Text style={styles.productKcal}>
                    {Math.round(scannedProduct.calories * barcodeServings)} kcal per pack
                  </Text>

                  <View style={styles.servingsStepperRow}>
                    <Text style={styles.servingsStepperLabel}>Servings:</Text>
                    <View style={styles.stepperWrap}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => setBarcodeServings((s) => Math.max(0.5, s - 0.5))}
                      >
                        <Minus size={16} color={colors.text} />
                      </TouchableOpacity>
                      <Text style={styles.stepperVal}>{barcodeServings}×</Text>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => setBarcodeServings((s) => Math.min(5, s + 0.5))}
                      >
                        <Plus size={16} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.addBarcodeBtn}
                    onPress={handleLogBarcodeProduct}
                    disabled={createMealMutation.isPending}
                  >
                    {createMealMutation.isPending ? (
                      <ActivityIndicator color="#000000" size="small" />
                    ) : (
                      <Text style={styles.addBarcodeBtnText}>Add to Log</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </CameraView>
      )}

      {/* Bottom Controls Bar */}
      <View style={[styles.bottomControls, { paddingBottom: Math.max(insets.bottom, 16) + 10 }]}>
        {/* Shutter / Gallery controls (only for snap mode) */}
        {mode === 'snap' && (
          <View style={styles.shutterRow}>
            <TouchableOpacity
              style={styles.galleryBtn}
              onPress={handlePickFromGallery}
              accessibilityRole="button"
              accessibilityLabel="Choose from photo gallery"
            >
              <ImageIcon size={24} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Large white shutter button centered */}
            <TouchableOpacity
              style={styles.shutterBtn}
              onPress={handleCapturePhoto}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
            >
              <View style={styles.shutterInner} />
            </TouchableOpacity>

            <View style={styles.galleryPlaceholder} />
          </View>
        )}

        {/* Segmented Control: Photo / Barcode / Describe */}
        <View style={styles.segmentedRow}>
          <TouchableOpacity
            style={[styles.modeSegment, mode === 'snap' && styles.modeSegmentOn]}
            onPress={() => setMode('snap')}
          >
            <Text style={[styles.modeText, mode === 'snap' && styles.modeTextOn]}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeSegment, mode === 'barcode' && styles.modeSegmentOn]}
            onPress={() => setMode('barcode')}
          >
            <Text style={[styles.modeText, mode === 'barcode' && styles.modeTextOn]}>Barcode</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeSegment, mode === 'describe' && styles.modeSegmentOn]}
            onPress={() => setMode('describe')}
          >
            <Text style={[styles.modeText, mode === 'describe' && styles.modeTextOn]}>Describe</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  permissionTitle: {
    fontFamily: font.bold,
    fontSize: 24,
    color: colors.text,
    letterSpacing: -0.5,
  },
  permissionSub: {
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.textDim,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionBtn: {
    height: 56,
    paddingHorizontal: 32,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  permissionBtnText: {
    fontFamily: font.semibold,
    fontSize: 17,
    color: '#000000',
  },
  textBtn: {
    paddingVertical: 10,
  },
  textBtnText: {
    fontFamily: font.medium,
    fontSize: 16,
    color: colors.textDim,
  },
  topBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  topCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRightActions: {
    flexDirection: 'row',
    gap: 12,
  },
  bottomControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingTop: 16,
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 36,
  },
  galleryBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryPlaceholder: {
    width: 48,
  },
  shutterBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  shutterInner: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
  },
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(28, 28, 30, 0.85)',
    borderRadius: radii.pill,
    padding: 4,
  },
  modeSegment: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },
  modeSegmentOn: {
    backgroundColor: '#FFFFFF',
  },
  modeText: {
    fontFamily: font.medium,
    fontSize: 14,
    color: colors.textDim,
  },
  modeTextOn: {
    fontFamily: font.semibold,
    color: '#000000',
  },
  describeView: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 110,
    gap: 16,
  },
  describeTitle: {
    fontFamily: font.bold,
    fontSize: 28,
    color: colors.text,
    letterSpacing: -0.6,
  },
  describeSub: {
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.textDim,
    lineHeight: 22,
  },
  describeInput: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 16,
    fontFamily: font.regular,
    fontSize: 17,
    color: colors.text,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  mealChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  mealChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  mealChipOn: {
    backgroundColor: colors.control,
  },
  mealChipText: {
    fontFamily: font.medium,
    fontSize: 13,
    color: colors.textDim,
  },
  mealChipTextOn: {
    color: colors.text,
    fontFamily: font.semibold,
  },
  analyzeBtn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzeBtnDisabled: {
    opacity: 0.35,
  },
  analyzeBtnText: {
    fontFamily: font.semibold,
    fontSize: 17,
    color: '#000000',
  },
  barcodeOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  scanHint: {
    fontFamily: font.medium,
    fontSize: 15,
    color: '#FFFFFF',
    marginTop: 20,
    textAlign: 'center',
  },
  barcodeLoadingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    marginTop: 16,
  },
  barcodeLoadingText: {
    fontFamily: font.medium,
    fontSize: 14,
    color: '#FFFFFF',
  },
  barcodeErrorBadge: {
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
    borderRadius: radii.card,
    padding: 16,
    marginTop: 20,
    alignItems: 'center',
    gap: 12,
  },
  barcodeErrorText: {
    fontFamily: font.medium,
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
  },
  switchModePill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  switchModePillText: {
    fontFamily: font.semibold,
    fontSize: 13,
    color: '#000000',
  },
  barcodeResultSheet: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 20,
    gap: 12,
  },
  productName: {
    fontFamily: font.bold,
    fontSize: 18,
    color: colors.text,
  },
  productBrand: {
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.textDim,
    marginTop: -8,
  },
  productKcal: {
    fontFamily: font.semibold,
    fontSize: 16,
    color: colors.text,
  },
  servingsStepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  servingsStepperLabel: {
    fontFamily: font.medium,
    fontSize: 15,
    color: colors.textDim,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperVal: {
    fontFamily: font.semibold,
    fontSize: 16,
    color: colors.text,
    minWidth: 24,
    textAlign: 'center',
  },
  addBarcodeBtn: {
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  addBarcodeBtnText: {
    fontFamily: font.semibold,
    fontSize: 16,
    color: '#000000',
  },
});
