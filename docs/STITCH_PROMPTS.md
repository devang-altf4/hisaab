# Hisaab — Prompt pack for Gemini (Google Stitch + Antigravity)

**Order of use**
1. **Stitch (design):** paste **Prompt 1** once to set the style, then **Prompts 2–10** one screen at a time in the same Stitch project. Iterate in Stitch until each screen looks right.
2. **Antigravity (build):** paste **Prompt 11** and point it at the Stitch designs (Stitch MCP or exported screens).
3. **Antigravity (P1 restyle):** paste **Prompt 12** in the same session. P1 ("How many skewers?" + "Wrong?") is already built and working; Prompt 12 only restyles it without breaking it.

**Status when these prompts were written:** backend on MongoDB with real AI (Gemini), 50 server tests + a 20-step end-to-end check passing, P1 and the item editor built and tested on real photos, limits switched off for the MVP preview, database reset to empty for fresh testing.

The onboarding flow (`app/onboarding.tsx`) is already finished in this style. It is the reference, not something to redesign.

---

## Prompt 1 — Stitch: design brief (paste first)

```
Design a mobile app called Hisaab: a calorie tracker for India that treats each day like a
profit-and-loss ledger. You snap a photo of a meal, AI works out calories, and the day ends
"in profit" (under your calorie budget) or "in loss" (over it). Frame: 390 × 844 phone, dark.

VISUAL TARGET: as polished and friendly as Cal AI (calai.app) in dark mode: big rounded cards,
huge confident numbers, circular macro rings, generous spacing, one obvious action per screen,
the camera button always one tap away. Make it feel like a top-10 App Store health app, not a
template.

STYLE — Apple-clean, like iOS Settings and Apple Fitness:
- Background true black #000000. Grouped surfaces #1C1C1E, raised controls #2C2C2E,
  hairline separators #38383A.
- Text white #FFFFFF, secondary #8E8E93, tertiary #48484A.
- Color has meaning, never decoration: green #10B981 = profit only, red #FF453A = loss only,
  amber #F59E0B = warnings/notices only. Macros: protein #F87171, carbs #FBBF24,
  fat #60A5FA, water #38BDF8.
- Typeface Inter. Large title 34 pt bold (tight tracking), section title 22 pt semibold,
  body 17 pt, captions 13–15 pt. Numbers use tabular figures.
- Primary button: white pill, 56 pt tall, black label. Secondary actions: plain grey text.
- Lists: iOS grouped-inset style, 14 pt corner radius, hairline separators, checkmarks for
  selection. No cards inside cards. No shadows, no gradients, no glows, no emoji,
  no ALL-CAPS labels. Sentence case everywhere. Thin line icons (Lucide style), 22 pt.
- 24 pt side margins, 8 pt spacing grid, generous empty space, one clear action per screen.
- Bottom tab bar: Home, Ledger, a raised round "+" capture button in the centre, Coach, Profile.

VOCABULARY (plain English, no Hindi): Budget = daily calorie target. Eaten. Burned = workout
calories, they add to the balance. Balance = calories left. In profit = under budget.
In loss = over budget.

The existing onboarding already uses this style: big left-aligned headline
"Track food the way you track money." and a mini ledger "Budget 2,000 / Eaten −1,450 /
Profit +550" with the profit in green. Match it.
```

## Prompt 2 — Stitch: Home

```
Home screen for Hisaab (use the style from the brief).
- Top: "Hisaab" wordmark left; a date control right: "‹ Today ›" (arrows step one day back or
  forward, never past today; shows "Yesterday" or "Mon, 20 Oct" for older days); small
  "5-day streak" text under the wordmark.
- Optional amber notice strip at the very top (design it, it only shows sometimes):
  "Demo mode: AI isn't connected, so photo results are samples."
- Balance block (no card border): huge number "1,240", label "calories left", and a pill
  "In profit, 1,240 kcal" in green. Below it one quiet row: Budget 1,860 · Eaten 820 · Burned 200.
- Three macro rings side by side: Protein 62 of 137 g, Carbs 98 of 212 g, Fat 31 of 52 g.
  Ring color = macro color, center shows grams left.
- Two compact tiles: Water "1.25 of 2.75 L" with a "+250 ml" button (long-press undoes);
  Exercise "200 kcal burned, 1 workout" with a "Log" button.
- "Today's meals" grouped list. Each row: 56 pt rounded photo thumbnail, meal name
  "Chicken Tikka Skewers", "Lunch, 1:30 PM", right side "474 kcal" and a small green "+28"
  or red "−120" tag, and a faint macro line "P 63 · C 4 · F 22".
- Show four row states in the design:
  1) analyzing: shimmer thumbnail + "Analyzing your meal…"
  2) needs an answer: under the meal name a one-line question "How many skewers?" with
     tappable number chips 2 3 4 5 (current guess highlighted)
  3) failed: "Couldn't read this meal" with "Retry" and "Describe instead"
  4) normal (done)
- Empty state: "Nothing logged yet today" and a white "Log a Meal" button.
```

## Prompt 3 — Stitch: Capture (camera, describe, barcode)

```
Capture flow for Hisaab, three modes, full screen, dark.
1) Photo: live camera fills the screen. Top: close X left, flash toggle right. Bottom:
   segmented control "Photo / Barcode / Describe", large white shutter button centered,
   gallery thumbnail button on the left.
2) Describe: title "Describe your meal", subtitle "Write it the way you'd say it.
   Quantities help." Large multi-line field with placeholder
   "e.g. 2 rotis, dal tadka and a plate of rice". Meal chips Breakfast / Lunch / Snack /
   Dinner. White "Analyze Meal" button pinned at the bottom.
3) Barcode: camera with a rounded scan frame and hint "Point at the barcode on the pack".
   Result sheet: product "Maggi 2-Minute Noodles", brand "Nestlé", "350 kcal per pack",
   servings stepper 0.5–5, white "Add to Log" button. Not-found state:
   "We couldn't find this product. Try a photo instead."
```

## Prompt 4 — Stitch: Meal details + "Wrong?" correction (includes the P1 feature)

```
Meal details screen for Hisaab (pushed from a meal row). Nav bar: back chevron, title
"Meal", trash icon.
- Photo at top, 4:3, 20 pt corners.
- Name "Chicken Tikka Skewers with Grilled Vegetables", under it "Lunch, 1:30 PM".
- Big "474 kcal" and a line "Keeps today in profit by 28 kcal" (green).
- Three macro tiles: Protein 63 g, Carbs 4 g, Fat 22 g.
- QUESTION CARD (shows when a photo has something countable that matters, like skewers,
  rotis or idlis): "How many skewers?" with chips 2 3 4 5, the AI's guess (3) pre-selected,
  and small text "We guessed 3. Tap the right number and we'll recalculate."
- "What's in it" grouped list, one row per item with weight and calories:
  "Grilled chicken tikka — 2 skewers, 200 g — 330 kcal",
  "Peppers and onions — 50 g — 20 kcal", "Oil — 1 tbsp — 124 kcal".
- Portion stepper "Portion 1×" with − and +.
- Health score "8 of 10" as a thin bar, and "Coach's take: High protein and light on carbs."
- Bottom: white "Done" button; under it two text buttons side by side: "Wrong?" and
  "Edit items".

Also design the EDIT ITEMS mode (opened by "Edit items"): totals are never typed. The calories
and macro tiles become a read-only live preview with a small note "Totals are calculated from
the items". The "What's in it" list becomes editable rows: item name field, grams field with
"g", the row's calories on the right, and a small remove (×) button. A row the user added or
renamed shows "AI on save" in amber instead of calories, and the preview says
"+ 1 item the AI will calculate when you save". "+ Add item" link under the list. Bottom:
"Cancel" and white "Save". Example rows: "Chicken tikka — 300 g — 495 kcal",
"Raita — 150 g — AI on save".

Also design the bottom sheet that opens from "Wrong?":
- Title "What's wrong?", subtitle "Tell us what it really is. AI will recalculate using
  your photo and these details."
- Field "What is it?" prefilled with the current name.
- Field "How much?" placeholder "e.g. 4 skewers, 1 plate rice".
- Field "Anything else?" (optional, multi-line) placeholder "e.g. cooked in butter,
  no oil, half portion".
- White "Recalculate" button with a loading state "Recalculating…".
- Small text link at the bottom: "Edit the items myself".
```

## Prompt 5 — Stitch: Ledger

```
Ledger screen for Hisaab. Large title "Ledger"; segmented control "7 days / 30 days".
- Summary group: "This week" and a big green "+2,140 kcal in profit", under it
  "About 0.28 kg of fat". Three small stats: Profit days 5, Loss days 1, Logged 6.
- Bar chart: one bar per day around a zero line, green bars up for profit, red down for loss,
  short grey stub for days with nothing logged. Day initials under the bars.
- "Day by day" grouped list: "Mon, 20 Oct — Eaten 1,640, Burned 200" with a right-aligned
  tag "+420" (green) / "−150" (red) / "Nothing logged" (grey).
```

## Prompt 6 — Stitch: Coach chat

```
Coach screen for Hisaab (AI nutrition coach). Header: "Coach", subtitle "Knows your numbers
for today", right side a small "4 free chats left" pill.
- Empty state: title "Ask your coach anything", then four tappable suggestion rows:
  "If I eat a slice of cake, how much loss is that?",
  "I have 400 kcal left. What should I eat for dinner?",
  "How is my day looking?", "How do I get more protein on a veg diet?"
- Conversation: user bubbles right (#2C2C2E), coach messages left with no bubble background,
  plain white text, like a modern AI chat. Typing state "Coach is checking your numbers…".
  Example coach reply: "A slice of chocolate cake is about 350 kcal. Your balance would go
  from 923 to 573, so you'd still be in profit. Keep dinner light."
- Input bar pinned above the keyboard: rounded field "Ask your coach…" and a round white
  send button.
```

## Prompt 7 — Stitch: Profile & settings

```
Profile screen for Hisaab, iOS Settings style grouped lists.
- Header row: initial avatar circle, name "Devang", "Lose weight, 72 kg", chevron
  "Edit profile".
- Daily budget group: Calories 1,860 kcal; Protein 137 g; Carbs 212 g; Fat 52 g; Water 2.75 L.
- Plan group: "Preview: no limits" with "Today: 4 photo scans, 2 coach chats"; row
  "See Hisaab Pro" (opens the paywall in test mode). Also design the later launch version of
  this group: "Free plan", "Photo scans today 2 of 3", "Coach chats today 1 of 5",
  "Upgrade to Pro" in green.
- Reminders group: toggle "Meal reminders"; stepper "Reminders per day 5";
  row "Send a test reminder".
- Health group: toggles "Apple Health", "Health Connect", row "Sync a demo workout".
- Trainer group: "Share with my trainer" showing code "HSB-7KQ2MX" with copy and share icons;
  "Remove trainer access" in red when a trainer is linked; "I'm a trainer" field
  "Enter a client's code" + "Link" button; client rows "Rahul — In profit, 1,280 kcal" with
  chevrons.
```

## Prompt 8 — Stitch: Paywall

```
Paywall sheet for Hisaab. Title "Hisaab Pro", subtitle "More scans, more coaching."
Checklist: "60 photo scans a day (free: 3)", "150 coach chats a day (free: 5)",
"Share your log with a trainer", "Smart meal reminders".
Two selectable plan rows: "Yearly ₹999" with a small "Save 44%" tag (selected) and
"Monthly ₹149". White "Start Pro" button. Tiny grey text "Test mode. No payment is taken."
Close X top right.
```

## Prompt 9 — Stitch: Workout sheet

```
Bottom sheet "Log a Workout" for Hisaab, subtitle "Calories you burn are added to today's
budget." Activity chips: Walking, Running, Gym, Yoga, Cricket, Badminton, Cycling, HIIT,
Dance. Duration chips 15, 30, 45, 60, 90 min. Optional field "Calories burned" with
placeholder "Auto-estimated". White "Log Workout" button. Below: "Today" list
"Cricket — 45 min — +281 kcal" with swipe-to-delete.
```

## Prompt 10 — Stitch: Trainer's client view

```
Read-only version of the Home screen that a fitness trainer sees for a client. Nav bar:
back chevron, title "Rahul's day", small grey "View only" label, Today / Yesterday control.
Same balance block, macro rings and meal list as Home, but no buttons to add or edit
anything and no question chips.
```

---

## Prompt 11 — Antigravity: implement the Stitch designs (paste with the designs)

```
You are implementing the Stitch designs for the Hisaab app in the existing Expo app at
/mobile (Expo SDK 57, expo-router, TypeScript, React Query). The backend and API client are
finished and tested. Your job is visual: restyle every screen to match the Stitch designs.

HARD RULES — these broke the app before; follow them exactly:
1. Do NOT edit src/api/hisaabApi.ts, src/api/client.ts, src/api/queries.ts (except adding new
   hooks), src/auth/*, metro.config.js or src/notifications/notificationService.ts.
   Never rewrite the API client.
2. Photo upload must stay base64 JSON: api.meals.analyze({ imageBase64, mimeType: 'image/jpeg' })
   after expo-image-manipulator with { base64: true }. NEVER use FormData for images: Expo's
   native fetch rejects React Native's { uri, name, type } parts
   ("Unsupported FormDataPart implementation").
3. Stay on Expo SDK 57. Do not upgrade or downgrade any package. Add packages only with
   `npx expo install <pkg>` and only if they work in Expo Go (no custom native code).
4. SafeAreaView must come from 'react-native-safe-area-context' (the react-native one does
   nothing on Android). Respect bottom insets: the tab bar and bottom buttons must sit above
   the Android gesture bar.
5. Fonts: use Inter via `font` from src/theme/fonts.ts (font.regular / medium / semibold /
   bold / heavy). Never set fontWeight together with a custom fontFamily (Android falls back
   to the system font).
6. Do not redesign onboarding (app/onboarding.tsx, src/onboarding/kit.tsx). Reuse its kit
   (Title, PrimaryButton, TextButton, ChoiceList, Segmented, ob colors) and move shared
   tokens into src/theme/tokens.ts so every screen uses one palette.
7. English only. Use the ledger vocabulary: Budget, Eaten, Burned, Balance, In profit, In loss.
8. No hardcoded data. Every number comes from the existing hooks (useDashboard, useLedger,
   useMeal, useChatHistory, useSubscription, useServerHealth, …).
9. Never let the user type total calories or total macros. Totals are always the sum of the
   meal's items (meal.ingredients). Editing happens per item in src/components/ItemEditor.tsx
   (restyle freely, keep previewRow / rowsFromIngredients and the save via useEditMealItems).
   Keep every existing behavior: meal states (analyzing / failed / done) with 2 s polling,
   Today/Yesterday, water undo by long-press, workout sheet, trainer read-only view (no
   edit/retry/questions on a client's meals), demo-mode notice from useServerHealth(), camera
   permission fallback to Describe, and the P1 pieces (see Prompt 12).
10. Limits are OFF for the MVP preview: usage.limitsEnabled === false. Never show "x free left"
    counters and never force the paywall. Keep the paywall reachable from Profile (test-mode
    upgrade) and keep the existing 402 PAYWALL_LIMIT handling code untouched for launch.
11. Never compute dates with toISOString() (UTC breaks the Indian day before 5:30 AM). Use
    localDateKey / daysAgoKey from src/lib/dates.ts.

ALSO BUILD (small features the redesign should include; all APIs already exist):
A. Edit profile screen (from the Profile header): name via api.me.patch({ name }), and goal,
   sex, age, height, weight, activity via api.me.updateProfile(profile). Reuse the onboarding
   kit (ChoiceList, Segmented, NumberRow). The server recalculates the daily budget; show the
   new number after saving.
B. Edit daily budget (Profile → Daily budget): calories, protein, carbs, fat, water via
   api.me.updateTargets({...}); "Reset to recommended" via api.me.updateTargets({ reset: true }).
C. Any-day navigation: Home header becomes "‹ Today ›" (step back day by day, can't go past
   today); useDashboard(date) already accepts any YYYY-MM-DD. Tapping a day in Ledger opens Home
   for that date.
D. One font everywhere: Inter (src/theme/fonts.ts) on every screen, not just onboarding.
E. Loading, empty and error states for every list; pull-to-refresh on Home and Ledger.
F. Accessibility: 44 pt minimum touch targets, accessibilityLabel on every icon-only button.

DONE MEANS:
- `npx tsc --noEmit` passes with 0 errors.
- `npx expo export --platform android` succeeds.
- In Expo Go on an Android phone: onboarding → Home → snap a photo (lands back on Home with an
  analyzing row that fills in) → answer "How many …?" if shown → meal details → "Wrong?" →
  Recalculate → Ledger → Coach → Profile → Edit profile → paywall → workout sheet all match the
  designs, nothing overlaps the status bar or gesture bar.
- List every file you changed at the end.
```

---

## Prompt 12 — Antigravity: restyle the P1 pieces (already built — do not re-wire)

```
P1 ("How many skewers?" + "Wrong?") is already built, wired to the backend and tested on real
photos. Restyle it to match Stitch Prompt 4 WITHOUT changing how it works.

FILES (restyle freely, keep the logic):
- src/components/ClarifyChips.tsx — the one-line question + number chips. Used on the Home meal
  row (variant "compact") and the meal screen (variant "card"). Uses useClarifyMeal().
- src/components/CorrectionSheet.tsx — the "What's wrong?" sheet. Uses useCorrectMeal().
- app/meal/[id].tsx — bottom bar "Wrong?" / "Edit" / "Done", question card under the photo,
  ingredient rows "quantity · grams g — calories kcal".
- src/components/ItemEditor.tsx — edit mode rows (name, grams, kcal preview, remove, add).
- src/api/queries.ts — useClarifyMeal / useCorrectMeal / useEditMealItems (do not change).

BEHAVIOR TO KEEP:
- meal.clarify: null, or { ingredientIndex, question, unit, current, options } — e.g.
  { question: "How many skewers?", unit: "skewer", current: 3, options: [2,3,4,5] }. Shown on
  photo meals when the AI couldn't count something for sure, or when a countable item is the
  main part of the meal. Never on typed meals. Ignoring it is fine: the guess stays.
- Chip tap → api.meals.clarify(meal.id, { pieces, ingredientIndex }) → instant recalculation
  (no AI call), question disappears. Spinner on the tapped chip while saving. Never shown in the
  trainer's read-only view.
- "Wrong?" → sheet with "What is it?" (prefilled with the dish name), "How much?", "Anything
  else?". "Recalculate" is enabled only when the name changed or another field has text. It
  sends only non-empty fields to api.meals.correct(...), shows "Recalculating…", closes on
  success, and shows the server's error message inline on failure (the meal is unchanged).
  No limit on how many times during the preview.
- "Edit the items myself" closes the sheet and opens edit mode.
- Edit mode edits ITEMS, never totals: same item + new grams → exact rescale (instant, no AI);
  removed rows drop out; new or renamed rows show "AI on save" and the server calculates them on
  Save via api.meals.editItems(id, { items: [{ ref?, name, grams? }], dishName?, mealType? }).
  The portion stepper is hidden while editing. Validation: every row needs a name, grams > 0
  if given, at least one row.
- Meal totals are always the sum of meal.ingredients; never recompute them on the client
  except the edit-mode preview from previewRow().

DONE MEANS: tsc passes; on the phone, a photo of skewers asks "How many skewers?" and tapping a
number updates the calories instantly; "Wrong?" → "paneer tikka" / "4 skewers" → Recalculate
updates the name and numbers within a few seconds; Edit items → change chicken to 300 g and
add "Raita 150 g" → Save → totals update and equal the sum of the rows.
```
