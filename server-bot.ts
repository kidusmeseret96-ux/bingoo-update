import { PRESET_BANKS, type AppLanguage, type PlayerWallet, type PresetBankKey } from './shared/bingo.ts';
import {
  type AdminGroupMessageRef,
  type BotTemplateButtonConfig,
  type BotTextTemplateRecord,
  PaymentButtonRecord,
  supabaseStore,
} from './server-db.ts';

export interface BotHubBridge {
  getWalletSnapshot: (playerId: string, name?: string, username?: string) => PlayerWallet;
  hasPlayer: (playerId: string) => boolean;
  getPlayerName: (playerId: string) => string | undefined;
  getAllPlayerIds: () => string[];
  creditDepositFromBot: (
    playerId: string,
    name: string,
    amountBirr: number,
    isRealDeposit?: boolean
  ) => Promise<PlayerWallet>;
  deductWithdrawFromBot: (playerId: string, name: string, amountBirr: number) => Promise<PlayerWallet>;
  setPlayerLanguage: (playerId: string, language: AppLanguage) => void;
  getPlayerLanguage: (playerId: string) => AppLanguage | undefined;
  isTelegramAdminId: (tgIdWithPrefix: string) => boolean;
  isPlayerBanned: (playerId: string) => boolean;
  recordInviteMission?: (referrerFullId: string) => void;
}

interface PendingAdminAmountInput {
  mode: 'deposit_accept' | 'withdraw_done';
  txId: string;
  groupChatId: string;
  promptChatId: string;
  adminUserId: string;
  adminName: string;
  promptMessageId: number | null;
  originalGroupMsgId: number | null;
  hasPhoto: boolean;
  originalTextOrCaption: string;
}

const BOT_STRINGS: Record<
  AppLanguage,
  {
    welcomeGreeting: (name: string) => string;
    balanceLine: (dep: number, won: number) => string;
    menuPrompt: string;
    contactPrompt: (name: string) => string;
    btnShareContact: string;
    contactSaved: string;
    bannedNotice: string;
    voucherPrompt: (bankName: string) => string;
    btnSkipVoucher: string;
    voucherApplied: (code: string, bonus: number) => string;
    voucherInvalid: string;
    btnPlay: string;
    btnDeposit: string;
    btnWithdraw: string;
    btnReferral: string;
    btnShareReferral: string;
    btnLanguage: string;
    btnBack: string;
    btnCancel: string;
    chooseLang: string;
    cancelled: string;
    noButtonsConfigured: string;
    depositFallbackReply: (bankName: string) => string;
    depositReceived: string;
    withdrawReceived: string;
    depositAcceptedUser: (amt: number, bankName: string) => string;
    depositAcceptedVoucherLine: (code: string, bonus: number) => string;
    depositRejectedUser: string;
    withdrawDoneUser: string;
    withdrawIncorrectUser: string;
    adminGroupNotConfigured: string;
    referralScreen: (
      link: string,
      signupBonus: number,
      deposit50Bonus: number,
      depositBonus: number,
      invitedCount: number,
      earnedBirr: number
    ) => string;
    referralShareText: (signupBonus: number, deposit50Bonus: number, depositBonus: number) => string;
    referralJoinedNotify: (
      referredName: string,
      signupBonus: number,
      deposit50Bonus: number,
      depositBonus: number
    ) => string;
    referralDepositNotify: (
      referredName: string,
      depositAmt: number,
      depositBonus: number,
      thresholdBirr: number
    ) => string;
  }
> = {
  en: {
    welcomeGreeting: (name) => `👋 Welcome, <b>${name}</b>!`,
    balanceLine: (dep, won) => `Deposited: ${dep} Birr · Won: ${won} Birr`,
    menuPrompt: 'Choose an option below or open the game directly:',
    contactPrompt: (name) =>
      `👋 Welcome to <b>Zemen Bingo</b>, <b>${name}</b>!\n\nTo verify your account and protect your wallet, please tap the button below to share your phone number.`,
    btnShareContact: '📱 Share My Phone Number',
    contactSaved: '✅ Phone number verified! Loading your Zemen Bingo menu...',
    bannedNotice: '🚫 Your account has been suspended by an administrator. Contact support if you believe this is an error.',
    voucherPrompt: (bankName) =>
      `🎫 <b>Have a Promo Voucher / Coupon Code?</b>\nSelected bank: <b>${bankName}</b>\n\nSend your voucher code below to earn a bonus on this deposit, or tap <b>Skip Voucher</b> to proceed directly.`,
    btnSkipVoucher: 'Skip Voucher ➡️',
    voucherApplied: (code, bonus) =>
      `✅ Voucher <b>${code}</b> applied! You will earn an extra <b>+${bonus} Birr</b> bonus once your deposit is accepted.`,
    voucherInvalid: '❌ Voucher code not found or inactive. Send another code or tap <b>Skip Voucher</b> below:',
    btnPlay: 'Play Zemen Bingo',
    btnDeposit: 'Deposit',
    btnWithdraw: 'Withdraw',
    btnReferral: 'Referral',
    btnShareReferral: 'Share Referral Link',
    btnLanguage: 'Language',
    btnBack: 'Back',
    btnCancel: 'Cancel',
    chooseLang: 'Choose your language (updates both bot and game):',
    cancelled: 'Cancelled. Back to main menu.',
    noButtonsConfigured: 'No banks are currently enabled. Please contact the admin.',
    depositFallbackReply: (bankName) =>
      `Selected ${bankName}. Send your deposit receipt photo or confirmation message here.`,
    depositReceived: 'Your deposit proof has been sent to the admin team. You will be notified once reviewed.',
    withdrawReceived: 'Your withdrawal request has been sent to the admin team.',
    depositAcceptedUser: (amt, bankName) =>
      `${amt} Birr (${bankName}) has been deposited to your account!`,
    depositAcceptedVoucherLine: (code, bonus) =>
      `\n🎁 Voucher <b>${code}</b> bonus: <b>+${bonus} Birr</b> added!`,
    depositRejectedUser: 'Your deposit request was rejected. Please check your details and try again.',
    withdrawDoneUser: 'Money has been sent to your account!',
    withdrawIncorrectUser: 'Your withdrawal info was incorrect. Please tap Withdraw and send valid details.',
    adminGroupNotConfigured: 'Admin group is not linked yet. An admin should run /setgroup inside the admin group.',
    referralScreen: (link, signupBonus, deposit50Bonus, depositBonus, invitedCount, earnedBirr) =>
      `🎁 <b>Invite Friends &amp; Earn Referral Bonuses!</b>\n\n` +
      `• Get a <b>${signupBonus} Birr</b> bonus when someone joins using your referral link.\n` +
      `• Get a <b>${deposit50Bonus} Birr</b> bonus when the person you referred makes their first deposit of <b>50+ Birr</b>!\n` +
      `• Get a <b>${depositBonus} Birr</b> bonus when the person you referred makes their first deposit of <b>100+ Birr</b>!\n\n` +
      `🔗 <b>Your Personal Referral Link:</b>\n<code>${escapeHtml(link)}</code>\n\n` +
      `📊 Invited: <b>${invitedCount}</b> · Total Bonus Earned: <b>${earnedBirr} Birr</b>`,
    referralShareText: (signupBonus, deposit50Bonus, depositBonus) =>
      `Join Zemen Bingo with my link! Invite friends to earn ${signupBonus} Birr on join + ${deposit50Bonus} Birr on first 50+ Birr deposit + ${depositBonus} Birr on first 100+ Birr deposit.`,
    referralJoinedNotify: (referredName, signupBonus, deposit50Bonus, depositBonus) =>
      `🎉 <b>${escapeHtml(referredName)}</b> joined using your referral link!\n` +
      `✅ You earned <b>+${signupBonus} Birr</b> bonus.\n` +
      `💡 You will also get <b>+${deposit50Bonus} Birr</b> on their first 50+ Birr deposit and <b>+${depositBonus} Birr</b> on their first 100+ Birr deposit!`,
    referralDepositNotify: (referredName, depositAmt, depositBonus, thresholdBirr) =>
      `💰 Your referred player <b>${escapeHtml(referredName)}</b> made their first <b>${depositAmt} Birr</b> (${thresholdBirr}+ Birr) deposit!\n` +
      `🎁 You received <b>+${depositBonus} Birr</b> referral bonus!`,
  },
  am: {
    welcomeGreeting: (name) => `👋 እንኳን ደህና መጡ፣ <b>${name}</b>!`,
    balanceLine: (dep, won) => `ተቀማጭ: ${dep} ብር · አሸናፊ: ${won} ብር`,
    menuPrompt: 'ከታች ካሉት አማራጮች አንዱን ይምረጡ ወይም ጨዋታውን ይክፈቱ:',
    contactPrompt: (name) =>
      `👋 እንኳን ወደ <b>ዘመን ቢንጎ</b> በደህና መጡ፣ <b>${name}</b>!\n\nመለያዎን ለማረጋገጥ እባክዎ ከታች ያለውን ቁልፍ በመጫን ስልክ ቁጥርዎን ያጋሩ።`,
    btnShareContact: '📱 ስልክ ቁጥሬን አጋራ',
    contactSaved: '✅ ስልክ ቁጥርዎ ተረጋግጧል! ዋናው ማውጫ እየተከፈተ ነው...',
    bannedNotice: '🚫 አካውንትዎ በአስተዳዳሪ ታግዷል። እባክዎ የድጋፍ ቡድኑን ያግኙ።',
    voucherPrompt: (bankName) =>
      `🎫 <b>የኩፖን / ቫውቸር ኮድ አለዎት?</b>\nየተመረጠው ባንክ: <b>${bankName}</b>\n\nተጨማሪ ቦነስ ለማግኘት የቫውቸር ኮድዎን ይላኩ ወይም <b>ዝለል</b> የሚለውን ይጫኑ።`,
    btnSkipVoucher: 'ቫውቸር ዝለል ➡️',
    voucherApplied: (code, bonus) =>
      `✅ ቫውቸር <b>${code}</b> ተተግብሯል! ገንዘብ ማስገባትዎ ሲረጋገጥ <b>+${bonus} ብር</b> ተጨማሪ ቦነስ ያገኛሉ።`,
    voucherInvalid: '❌ የላኩት ቫውቸር አልተገኘም ወይም ጊዜው አልፏል። ሌላ ኮድ ይላኩ ወይም <b>ቫውቸር ዝለል</b> ይጫኑ:',
    btnPlay: 'ዘመን ቢንጎ ይጫወቱ',
    btnDeposit: 'ገንዘብ አስገባ (Deposit)',
    btnWithdraw: 'ገንዘብ አውጣ (Withdraw)',
    btnReferral: 'ጓደኛ ይጋብዙ (Referral)',
    btnShareReferral: 'ሊንኩን ያጋሩ',
    btnLanguage: 'ቋንቋ (Language)',
    btnBack: 'ተመለስ',
    btnCancel: 'ሰርዝ',
    chooseLang: 'ቋንቋ ይምረጡ (ቦቱን እና ጨዋታውን ይቀይራል):',
    cancelled: 'ተሰርዟል። ወደ ዋናው ማውጫ ተመልሰዋል።',
    noButtonsConfigured: 'ምንም የባንክ አማራጭ አልተከፈተም። እባክዎ አስተዳዳሪውን ያግኙ።',
    depositFallbackReply: (bankName) =>
      `${bankName} ተመርጧል። የክፍያ ደረሰኝ ፎቶ ወይም መልእክት እዚህ ይላኩ።`,
    depositReceived: 'የገንዘብ ማስገቢያ መረጃዎ ለአስተዳዳሪዎች ተልኳል። ሲረጋገጥ መልእክት ይደርስዎታል።',
    withdrawReceived: 'የገንዘብ ማውጫ ጥያቄዎ ለአስተዳዳሪዎች ተልኳል።',
    depositAcceptedUser: (amt, bankName) =>
      `${amt} ብር (${bankName}) ወደ አካውንትዎ ገብቷል!`,
    depositAcceptedVoucherLine: (code, bonus) =>
      `\n🎁 የቫውቸር <b>${code}</b> ቦነስ: <b>+${bonus} ብር</b> ተጨምሯል!`,
    depositRejectedUser: 'የገንዘብ ማስገቢያ ጥያቄዎ ውድቅ ተደርጓል። እባክዎ ትክክለኛ መረጃ ይላኩ።',
    withdrawDoneUser: 'ገንዘቡ ወደ አካውንትዎ ተልኳል!',
    withdrawIncorrectUser: 'የላኩት የገንዘብ ማውጫ መረጃ ትክክል አይደለም። እባክዎ ትክክለኛ መረጃ ይላኩ።',
    adminGroupNotConfigured: 'የአስተዳዳሪ ግሩፕ አልተገናኘም። አስተዳዳሪው በግሩፑ ውስጥ /setgroup ይጻፍ።',
    referralScreen: (link, signupBonus, deposit50Bonus, depositBonus, invitedCount, earnedBirr) =>
      `🎁 <b>ጓደኞችን ይጋብዙ እና ቦነስ ያግኙ!</b>\n\n` +
      `• በሊንክዎ አንድ ሰው ሲቀላቀል ወዲያውኑ የ<b>${signupBonus} ብር</b> ቦነስ ያገኛሉ።\n` +
      `• የጋበዙት ሰው ለመጀመሪያ ጊዜ <b>50 ብር እና ከዚያ በላይ</b> ገንዘብ ሲያስገባ (Deposit) የ<b>${deposit50Bonus} ብር</b> ቦነስ ያገኛሉ!\n` +
      `• የጋበዙት ሰው ለመጀመሪያ ጊዜ <b>100 ብር እና ከዚያ በላይ</b> ገንዘብ ሲያስገባ (Deposit) የ<b>${depositBonus} ብር</b> ቦነስ ያገኛሉ!\n\n` +
      `🔗 <b>የእርስዎ የግብዣ ሊንክ:</b>\n<code>${escapeHtml(link)}</code>\n\n` +
      `📊 የጋበዙት: <b>${invitedCount}</b> · ጠቅላላ ያገኙት ቦነስ: <b>${earnedBirr} ብር</b>`,
    referralShareText: (signupBonus, deposit50Bonus, depositBonus) =>
      `በሊንኬ ዘመን ቢንጎን ይቀላቀሉ! ጓደኞችን ሲጋብዙ ${signupBonus} ብር + መጀመሪያ 50+ ብር ሲያስገቡ ${deposit50Bonus} ብር + መጀመሪያ 100+ ብር ሲያስገቡ ${depositBonus} ብር ያግኙ።`,
    referralJoinedNotify: (referredName, signupBonus, deposit50Bonus, depositBonus) =>
      `🎉 <b>${escapeHtml(referredName)}</b> በግብዣ ሊንክዎ ተቀላቅሏል!\n` +
      `✅ <b>+${signupBonus} ብር</b> ቦነስ ወደ ሂሳብዎ ገብቷል።\n` +
      `💡 ለመጀመሪያ ጊዜ 50+ ብር ሲያስገቡ <b>+${deposit50Bonus} ብር</b> እና 100+ ብር ሲያስገቡ <b>+${depositBonus} ብር</b> ያገኛሉ!`,
    referralDepositNotify: (referredName, depositAmt, depositBonus, thresholdBirr) =>
      `💰 የጋበዙት <b>${escapeHtml(referredName)}</b> ለመጀመሪያ ጊዜ <b>${depositAmt} ብር</b> (${thresholdBirr}+ ብር) አስገብተዋል!\n` +
      `🎁 የ<b>+${depositBonus} ብር</b> የግብዣ ቦነስ አግኝተዋል!`,
  },
  om: {
    welcomeGreeting: (name) => `👋 Baga nagaan dhuftan, <b>${name}</b>!`,
    balanceLine: (dep, won) => `Kuufama: ${dep} Birrii · Moo'ame: ${won} Birrii`,
    menuPrompt: 'Filannoo armaan gadii keessaa tokko filadhu ykn tapha bani:',
    contactPrompt: (name) =>
      `👋 Baga gara <b>Zemen Bingo</b> nagaan dhuftan, <b>${name}</b>!\n\nHerrega keessan mirkaneessuuf maaloo furtuu gadii tuquun lakkoofsa bilbilaa keessan ergaa.`,
    btnShareContact: '📱 Lakkoofsa Bilbilaa Qoodi',
    contactSaved: '✅ Lakkoofsi bilbilaa keessan mirkanaa’eera! Menu banamaa jira...',
    bannedNotice: '🚫 Herregni keessan bulchaadhaan uggurameera. Maaloo deeggarsa qunnamaa.',
    voucherPrompt: (bankName) =>
      `🎫 <b>Koodii Vaawucharii / Kuupponii Qabduu?</b>\nBaankii filatame: <b>${bankName}</b>\n\nBadhaasa dabalataa argachuuf koodii keessan ergaa ykn <b>Irra Darbi</b> tuqaa.`,
    btnSkipVoucher: 'Vaawuchara Irra Darbi ➡️',
    voucherApplied: (code, bonus) =>
      `✅ Vaawucharri <b>${code}</b> hojii irra ooleera! Galchiin keessan yoo mirkanaa’u badhaasa dabalataa <b>+${bonus} Birrii</b> ni argattu.`,
    voucherInvalid: '❌ Koodiin kun hin argamne ykn yeroon isaa darbeera. Koodii biraa ergaa ykn <b>Irra Darbi</b> tuqaa:',
    btnPlay: 'Zemen Bingo Taphadhu',
    btnDeposit: 'Maallaqa Galchi (Deposit)',
    btnWithdraw: 'Maallaqa Baasi (Withdraw)',
    btnReferral: 'Hiriyaa Afeeri (Referral)',
    btnShareReferral: 'Liinkii Qoodi',
    btnLanguage: 'Afaan (Language)',
    btnBack: 'Deebi’i',
    btnCancel: 'Haqi',
    chooseLang: 'Afaan kee filadhu (bootii fi tapha ni jijjiira):',
    cancelled: 'Haqameera. Gara menu jalqabaatti deebiteetta.',
    noButtonsConfigured: 'Baankiin baname hin jiru. Maaloo bulchaa qunnamaa.',
    depositFallbackReply: (bankName) =>
      `${bankName} filatameera. Suuraa nagahee ykn ergaa mirkaneessaa asitti ergi.`,
    depositReceived: 'Ragaan galchii keessanii gara bulchitootaatti ergameera. Yeroo mirkanaa’u isin beeksisna.',
    withdrawReceived: 'Gaaffiin baasii keessanii gara bulchitootaatti ergameera.',
    depositAcceptedUser: (amt, bankName) =>
      `Birrii ${amt} (${bankName}) gara herrega keessaniitti galeera!`,
    depositAcceptedVoucherLine: (code, bonus) =>
      `\n🎁 Badhaasa vaawucharaa <b>${code}</b>: <b>+${bonus} Birrii</b> dabalameera!`,
    depositRejectedUser: 'Gaaffiin galchii keessanii fudhatama hin arganne. Maaloo irra deebi’aa yaalaa.',
    withdrawDoneUser: 'Maallaqni gara herrega keessaniitti ergameera!',
    withdrawIncorrectUser: 'Odeeffannoon baasii ergitan sirrii miti. Maaloo odeeffannoo sirrii ergaa.',
    adminGroupNotConfigured: 'Gareen bulchaa hin hidhamne. Bulchaan garee keessatti /setgroup haa barreessu.',
    referralScreen: (link, signupBonus, deposit50Bonus, depositBonus, invitedCount, earnedBirr) =>
      `🎁 <b>Hiriyoota Afeeraa Badhaasa Argadhaa!</b>\n\n` +
      `• Namni tokko liinkii keessaniin yoo makamu battalumatti badhaasa <b>Birrii ${signupBonus}</b> ni argattu.\n` +
      `• Namni isin afeertan yeroo jalqabaaf maallaqa <b>Birrii 50 fi isaa ol</b> yoo galchu (Deposit) badhaasa <b>Birrii ${deposit50Bonus}</b> ni argattu!\n` +
      `• Namni isin afeertan yeroo jalqabaaf maallaqa <b>Birrii 100 fi isaa ol</b> yoo galchu (Deposit) badhaasa <b>Birrii ${depositBonus}</b> ni argattu!\n\n` +
      `🔗 <b>Liinkii Afeerraa Keessanii:</b>\n<code>${escapeHtml(link)}</code>\n\n` +
      `📊 Kan Afeertan: <b>${invitedCount}</b> · Badhaasa Waliigalaa: <b>Birrii ${earnedBirr}</b>`,
    referralShareText: (signupBonus, deposit50Bonus, depositBonus) =>
      `Liinkii kootiin Zemen Bingo makamaa! Namoota afeeruun Birrii ${signupBonus} + yoo yeroo jalqabaaf Birrii 50+ galchan Birrii ${deposit50Bonus} + yoo yeroo jalqabaaf Birrii 100+ galchan Birrii ${depositBonus} argadhaa.`,
    referralJoinedNotify: (referredName, signupBonus, deposit50Bonus, depositBonus) =>
      `🎉 <b>${escapeHtml(referredName)}</b> liinkii afeerraa keessaniin makameera!\n` +
      `✅ Badhaasni <b>+${signupBonus} Birrii</b> herrega keessaniitti dabalamera.\n` +
      `💡 Yeroo jalqabaaf Birrii 50+ yoo galchan <b>+${deposit50Bonus} Birrii</b> akkasumas Birrii 100+ yoo galchan <b>+${depositBonus} Birrii</b> ni argattu!`,
    referralDepositNotify: (referredName, depositAmt, depositBonus, thresholdBirr) =>
      `💰 Namni isin afeertan <b>${escapeHtml(referredName)}</b> yeroo jalqabaaf <b>Birrii ${depositAmt}</b> (${thresholdBirr}+ Birrii) galcheera!\n` +
      `🎁 Badhaasa afeerraa <b>+${depositBonus} Birrii</b> argattaniittu!`,
  },
};

function getLocalizedBankName(bankKey: PresetBankKey, lang: AppLanguage, fallback?: string): string {
  const found = PRESET_BANKS.find((b) => b.key === bankKey);
  if (found) return found.names[lang] || found.names.en;
  return fallback || bankKey;
}

function getCanonicalBankName(bankKey: PresetBankKey | string | null, fallback?: string | null): string {
  const found = PRESET_BANKS.find((b) => b.key === bankKey);
  return found ? found.names.en : fallback || 'Bank';
}

function escapeHtml(input: string): string {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatMessageWithCopyable(messageText: string, copyableText?: string | null): string {
  const raw = String(messageText || '');
  const copyRaw = String(copyableText || '').trim();
  if (!copyRaw) return escapeHtml(raw);

  // Support either full copyable text or newline/comma-separated copyable values
  const targets = copyRaw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (targets.length === 0) return escapeHtml(raw);

  // Scan raw text sequentially so HTML escaping never breaks inside matches
  let out = '';
  let idx = 0;
  while (idx < raw.length) {
    let earliestIdx = -1;
    let matchedToken = '';
    for (const token of targets) {
      const found = raw.indexOf(token, idx);
      if (found !== -1 && (earliestIdx === -1 || found < earliestIdx)) {
        earliestIdx = found;
        matchedToken = token;
      }
    }
    if (earliestIdx === -1) {
      out += escapeHtml(raw.slice(idx));
      break;
    }
    if (earliestIdx > idx) {
      out += escapeHtml(raw.slice(idx, earliestIdx));
    }
    out += `<code>${escapeHtml(matchedToken)}</code>`;
    idx = earliestIdx + matchedToken.length;
  }
  return out;
}

function interpolateTemplate(raw: string, vars: Record<string, string | number>): string {
  let out = raw;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

function decorateSeasonalBroadcast(text: string, theme: string): string {
  if (theme === 'christmas') {
    return `🎄❄️✨ <b>MERRY CHRISTMAS · ገና</b> ✨❄️🎄\n\n${escapeHtml(text)}\n\n❄️🎁🎅 Play Zemen Bingo Holiday Specials!`;
  }
  if (theme === 'enkutatash') {
    return `🌼🌻🇪🇹 <b>ENKUTATASH · መልካም አዲስ ዓመት!</b> 🇪🇹🌻🌼\n\n${escapeHtml(text)}\n\n🌻🌼 Celebrate New Year with Golden Jackpots!`;
  }
  if (theme === 'golden') {
    return `🏆✨🌟 <b>GOLDEN JACKPOT ALERT</b> 🌟✨🏆\n\n${escapeHtml(text)}`;
  }
  if (theme === 'cyber') {
    return `⚡🔮🎮 <b>MEGA NEON NIGHT</b> 🎮🔮⚡\n\n${escapeHtml(text)}`;
  }
  return escapeHtml(text);
}

function chunkButtons<T>(items: T[], perRow = 2): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += perRow) {
    rows.push(items.slice(i, i + perRow));
  }
  return rows;
}

export class TelegramBotHandler {
  private pendingAdminAmounts = new Map<string, PendingAdminAmountInput>();
  private cachedBotUsername: string | null = null;
  private isProcessingBroadcasts = false;

  constructor(
    private readonly botToken: string,
    private readonly hub: BotHubBridge,
    private readonly resolveMiniAppUrl: (fallbackUrl: string) => string
  ) {}

  public async callApi(method: string, body: Record<string, unknown>) {
    if (!this.botToken) return null;
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        ok: boolean;
        description?: string;
        parameters?: { retry_after?: number };
        result?: any;
      };
      if (!data.ok) {
        console.error(`[Telegram API Error] ${method}:`, data.description || data);
      }
      return data;
    } catch (err) {
      console.error(`[Telegram API Network Error] ${method}:`, err);
      return null;
    }
  }

  private async getBotUsername(): Promise<string> {
    if (this.cachedBotUsername) return this.cachedBotUsername;
    const me = await this.callApi('getMe', {});
    const username = me?.result?.username ? String(me.result.username) : '';
    if (username) {
      this.cachedBotUsername = username;
    }
    return username;
  }

  private async isTelegramGroupAdmin(chatId: string | number, userId: number, chatType: string): Promise<boolean> {
    if (this.hub.isTelegramAdminId(`tg_${userId}`)) return true;
    const member = await this.callApi('getChatMember', { chat_id: chatId, user_id: userId });
    const status = member?.result?.status;
    if (status === 'creator' || status === 'administrator') return true;
    if (chatType === 'channel') {
      const { config } = await supabaseStore.getBotConfigAndButtons();
      const targets = supabaseStore.getAllTargetGroupIds(config);
      if (targets.includes(String(chatId))) return true;
    }
    return false;
  }

  private buildMiniAppUrlWithLang(baseMiniAppUrl: string, lang: AppLanguage): string {
    const sep = baseMiniAppUrl.includes('?') ? '&' : '?';
    return `${baseMiniAppUrl}${sep}lang=${lang}`;
  }

  private findTemplate(
    templates: BotTextTemplateRecord[],
    key: string,
    lang: AppLanguage
  ): BotTextTemplateRecord | undefined {
    return (
      templates.find((t) => t.template_key === key && t.language === lang) ||
      templates.find((t) => t.template_key === key && t.language === 'en') ||
      templates.find((t) => t.template_key === key)
    );
  }

  private buildInlineButtonsFromConfig(
    buttons: BotTemplateButtonConfig[],
    miniAppBaseUrl: string,
    lang: AppLanguage
  ): Array<Array<Record<string, unknown>>> {
    const rows: Array<Array<Record<string, unknown>>> = [];
    for (const btn of buttons) {
      if (!btn || !btn.label) continue;
      if (btn.action_type === 'url' && btn.action_value) {
        rows.push([{ text: btn.label, url: btn.action_value }]);
      } else if (btn.action_type === 'web_app') {
        const targetUrl = btn.action_value || this.buildMiniAppUrlWithLang(miniAppBaseUrl, lang);
        rows.push([{ text: btn.label, web_app: { url: targetUrl } }]);
      } else if (btn.action_type === 'template' && btn.action_value) {
        rows.push([{ text: btn.label, callback_data: `tpl:${btn.action_value}` }]);
      } else if (btn.action_type === 'callback' && btn.action_value) {
        rows.push([{ text: btn.label, callback_data: btn.action_value }]);
      }
    }
    return rows;
  }

  private async sendContactPrompt(
    chatId: number | string,
    displayName: string,
    lang: AppLanguage,
    templates: BotTextTemplateRecord[]
  ) {
    const t = BOT_STRINGS[lang];
    const tpl = this.findTemplate(templates, 'contact_prompt', lang);
    const text = tpl?.message_text?.trim()
      ? escapeHtml(interpolateTemplate(tpl.message_text, { name: displayName }))
      : t.contactPrompt(escapeHtml(displayName));
    const btnLabel = tpl?.buttons_config?.[0]?.label?.trim() || t.btnShareContact;

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: {
        keyboard: [[{ text: btnLabel, request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  }

  private async sendCustomTemplateNode(
    chatId: number | string,
    tgUserId: string,
    displayName: string,
    username: string | undefined,
    lang: AppLanguage,
    miniAppBaseUrl: string,
    templateKey: string,
    editMessageId?: number
  ): Promise<boolean> {
    const templates = await supabaseStore.getBotTemplates();
    const tpl = this.findTemplate(templates, templateKey, lang);
    if (!tpl) return false;

    const t = BOT_STRINGS[lang];
    const wallet = this.hub.getWalletSnapshot(`tg_${tgUserId}`, displayName, username);
    const interpolated = interpolateTemplate(tpl.message_text, {
      name: displayName,
      dep: wallet.depositedBalance,
      won: wallet.wonBalance,
      total: wallet.depositedBalance + wallet.wonBalance,
      rank: String(wallet.rankTier || 'bronze').toUpperCase(),
    });

    const inline_keyboard = this.buildInlineButtonsFromConfig(tpl.buttons_config || [], miniAppBaseUrl, lang);
    const hasHomeBtn = (tpl.buttons_config || []).some((b) => b.action_value === 'menu:home');
    if (!hasHomeBtn) {
      inline_keyboard.push([{ text: `⬅️ ${t.btnBack}`, callback_data: 'menu:home' }]);
    }

    const text = escapeHtml(interpolated);
    if (editMessageId) {
      await this.callApi('editMessageText', {
        chat_id: chatId,
        message_id: editMessageId,
        text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard },
      });
    } else {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard },
      });
    }
    return true;
  }

  private async sendHomeMenu(
    chatId: number | string,
    tgUserId: string,
    displayName: string,
    username: string | undefined,
    lang: AppLanguage,
    miniAppBaseUrl: string,
    editMessageId?: number
  ) {
    const t = BOT_STRINGS[lang];
    const templates = await supabaseStore.getBotTemplates();
    const tpl = this.findTemplate(templates, 'welcome_menu', lang);
    const wallet = this.hub.getWalletSnapshot(`tg_${tgUserId}`, displayName, username);
    const playUrl = this.buildMiniAppUrlWithLang(miniAppBaseUrl, lang);

    let text: string;
    if (tpl?.message_text?.trim()) {
      text = escapeHtml(
        interpolateTemplate(tpl.message_text, {
          name: displayName,
          dep: wallet.depositedBalance,
          won: wallet.wonBalance,
          total: wallet.depositedBalance + wallet.wonBalance,
          rank: String(wallet.rankTier || 'bronze').toUpperCase(),
        })
      );
    } else {
      text =
        `${t.welcomeGreeting(escapeHtml(displayName))}\n` +
        `🎱 <b>Zemen Bingo</b>\n` +
        `${escapeHtml(t.balanceLine(wallet.depositedBalance, wallet.wonBalance))}\n\n` +
        `${escapeHtml(t.menuPrompt)}`;
    }

    const customBtns = tpl?.buttons_config || [];
    const findLabel = (key: string, fallback: string) => {
      const found = customBtns.find(
        (b) => b.action_value === key || b.action_value === `builtin:${key}`
      );
      return found?.label?.trim() || fallback;
    };

    const inline_keyboard: Array<Array<Record<string, unknown>>> = [
      [{ text: findLabel('play', `🎮 ${t.btnPlay}`), web_app: { url: playUrl } }],
      [
        { text: findLabel('menu:deposit', `💰 ${t.btnDeposit}`), callback_data: 'menu:deposit' },
        { text: findLabel('menu:withdraw', `💸 ${t.btnWithdraw}`), callback_data: 'menu:withdraw' },
      ],
      [
        { text: findLabel('menu:referral', `🎁 ${t.btnReferral}`), callback_data: 'menu:referral' },
        { text: findLabel('menu:language', `🌐 ${t.btnLanguage}`), callback_data: 'menu:language' },
      ],
    ];

    // Append any extra custom buttons added on welcome_menu in Web Admin
    const reserved = new Set(['play', 'builtin:play', 'menu:deposit', 'menu:withdraw', 'menu:referral', 'menu:language']);
    const extraBtns = customBtns.filter((b) => !reserved.has(b.action_value));
    for (const row of this.buildInlineButtonsFromConfig(extraBtns, miniAppBaseUrl, lang)) {
      inline_keyboard.push(row);
    }

    const reply_markup = { inline_keyboard };

    if (editMessageId) {
      await this.callApi('editMessageText', {
        chat_id: chatId,
        message_id: editMessageId,
        text,
        parse_mode: 'HTML',
        reply_markup,
      });
    } else {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup,
      });
    }
  }

  private async sendReferralMenu(
    chatId: number | string,
    tgUserId: string,
    lang: AppLanguage,
    miniAppBaseUrl: string,
    editMessageId?: number
  ) {
    const t = BOT_STRINGS[lang];
    const [{ config }, botUsername, stats, templates] = await Promise.all([
      supabaseStore.getBotConfigAndButtons(),
      this.getBotUsername(),
      supabaseStore.getReferralStatsForUser(`tg_${tgUserId}`),
      supabaseStore.getBotTemplates(),
    ]);

    const refLink = botUsername
      ? `https://t.me/${botUsername}?start=ref_${tgUserId}`
      : `${miniAppBaseUrl}?ref=${tgUserId}`;
    const signupBonus = config.referralSignupBonus;
    const deposit50Bonus = config.referralDeposit50Bonus;
    const depositBonus = config.referralDepositBonus;

    const tpl = this.findTemplate(templates, 'referral_intro', lang);
    const text = tpl?.message_text?.trim()
      ? formatMessageWithCopyable(
          interpolateTemplate(tpl.message_text, {
            link: refLink,
            signup_bonus: signupBonus,
            deposit50_bonus: deposit50Bonus,
            deposit100_bonus: depositBonus,
            invited: stats.invitedCount,
            earned: stats.earnedBirr,
          }),
          refLink
        )
      : t.referralScreen(refLink, signupBonus, deposit50Bonus, depositBonus, stats.invitedCount, stats.earnedBirr);

    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(
      t.referralShareText(signupBonus, deposit50Bonus, depositBonus)
    )}`;

    const extraRows = this.buildInlineButtonsFromConfig(
      (tpl?.buttons_config || []).filter((b) => b.action_value !== 'menu:home'),
      miniAppBaseUrl,
      lang
    );

    const reply_markup = {
      inline_keyboard: [
        [{ text: `📤 ${t.btnShareReferral}`, url: shareUrl }],
        ...extraRows,
        [{ text: `⬅️ ${t.btnBack}`, callback_data: 'menu:home' }],
      ],
    };

    if (editMessageId) {
      await this.callApi('editMessageText', {
        chat_id: chatId,
        message_id: editMessageId,
        text,
        parse_mode: 'HTML',
        reply_markup,
      });
    } else {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup,
      });
    }
  }

  private async sendDepositMenu(
    chatId: number | string,
    lang: AppLanguage,
    miniAppBaseUrl: string,
    editMessageId?: number
  ) {
    const t = BOT_STRINGS[lang];
    const [{ config, buttons }, templates] = await Promise.all([
      supabaseStore.getBotConfigAndButtons(),
      supabaseStore.getBotTemplates(),
    ]);
    const depButtons = buttons.filter((b) => b.flow_type === 'deposit');

    if (depButtons.length === 0) {
      const payload = {
        chat_id: chatId,
        text: escapeHtml(t.noButtonsConfigured),
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: `⬅️ ${t.btnBack}`, callback_data: 'menu:home' }]] },
      };
      if (editMessageId) {
        await this.callApi('editMessageText', { ...payload, message_id: editMessageId });
      } else {
        await this.callApi('sendMessage', payload);
      }
      return;
    }

    const tpl = this.findTemplate(templates, 'deposit_intro', lang);
    const introMsg = tpl?.message_text?.trim() || config.depositIntroText;

    const rows: Array<Array<Record<string, unknown>>> = chunkButtons(
      depButtons.map((b) => ({
        text: getLocalizedBankName(b.bank_key, lang, b.label),
        callback_data: `dep:${b.bank_key}`,
      })),
      2
    );
    for (const extraRow of this.buildInlineButtonsFromConfig(tpl?.buttons_config || [], miniAppBaseUrl, lang)) {
      rows.push(extraRow);
    }
    rows.push([{ text: `⬅️ ${t.btnBack}`, callback_data: 'menu:home' }]);

    const text = `💰 <b>${escapeHtml(t.btnDeposit)}</b>\n\n${escapeHtml(introMsg)}`;
    if (editMessageId) {
      await this.callApi('editMessageText', {
        chat_id: chatId,
        message_id: editMessageId,
        text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: rows },
      });
    } else {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: rows },
      });
    }
  }

  private async sendWithdrawMenu(
    chatId: number | string,
    lang: AppLanguage,
    miniAppBaseUrl: string,
    editMessageId?: number
  ) {
    const t = BOT_STRINGS[lang];
    const [{ config, buttons }, templates] = await Promise.all([
      supabaseStore.getBotConfigAndButtons(),
      supabaseStore.getBotTemplates(),
    ]);
    const wdButtons = buttons.filter((b) => b.flow_type === 'withdraw');

    if (wdButtons.length === 0) {
      const payload = {
        chat_id: chatId,
        text: escapeHtml(t.noButtonsConfigured),
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: `⬅️ ${t.btnBack}`, callback_data: 'menu:home' }]] },
      };
      if (editMessageId) {
        await this.callApi('editMessageText', { ...payload, message_id: editMessageId });
      } else {
        await this.callApi('sendMessage', payload);
      }
      return;
    }

    const tpl = this.findTemplate(templates, 'withdraw_intro', lang);
    const introMsg = tpl?.message_text?.trim() || config.withdrawIntroText;

    const rows: Array<Array<Record<string, unknown>>> = chunkButtons(
      wdButtons.map((b) => ({
        text: getLocalizedBankName(b.bank_key, lang, b.label),
        callback_data: `wd:${b.bank_key}`,
      })),
      2
    );
    for (const extraRow of this.buildInlineButtonsFromConfig(tpl?.buttons_config || [], miniAppBaseUrl, lang)) {
      rows.push(extraRow);
    }
    rows.push([{ text: `⬅️ ${t.btnBack}`, callback_data: 'menu:home' }]);

    const text = `💸 <b>${escapeHtml(t.btnWithdraw)}</b>\n\n${escapeHtml(introMsg)}`;
    if (editMessageId) {
      await this.callApi('editMessageText', {
        chat_id: chatId,
        message_id: editMessageId,
        text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: rows },
      });
    } else {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: rows },
      });
    }
  }

  private async sendLanguageMenu(chatId: number | string, lang: AppLanguage, editMessageId?: number) {
    const t = BOT_STRINGS[lang];
    const rows = [
      [{ text: '🇪🇹 አማርኛ (Amharic)', callback_data: 'lang:am' }],
      [{ text: '🇬🇧 English', callback_data: 'lang:en' }],
      [{ text: '🇪🇹 Afaan Oromoo', callback_data: 'lang:om' }],
      [{ text: `⬅️ ${t.btnBack}`, callback_data: 'menu:home' }],
    ];
    const payload = {
      chat_id: chatId,
      text: `🌐 ${escapeHtml(t.chooseLang)}`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: rows },
    };
    if (editMessageId) {
      await this.callApi('editMessageText', { ...payload, message_id: editMessageId });
    } else {
      await this.callApi('sendMessage', payload);
    }
  }

  private async sendSelectedBankDepositInstructions(
    chatId: number | string,
    lang: AppLanguage,
    btn: PaymentButtonRecord
  ) {
    const t = BOT_STRINGS[lang];
    const displayBank = getLocalizedBankName(btn.bank_key, lang, btn.label);
    const rawReply = btn.response_text.trim() || t.depositFallbackReply(displayBank);
    const formatted = formatMessageWithCopyable(rawReply, btn.copyable_text);

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text: `<b>${escapeHtml(displayBank)}</b>\n\n${formatted}`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: `❌ ${t.btnCancel}`, callback_data: 'menu:cancel' }]],
      },
    });
  }

  private getPendingAdminKey(promptChatId: string, adminUserId: string): string {
    return `${promptChatId}::${adminUserId}`;
  }

  private getPendingAdminMsgKey(promptChatId: string, promptMessageId: number): string {
    return `${promptChatId}::msg::${promptMessageId}`;
  }

  private setPendingAdminInput(entry: PendingAdminAmountInput) {
    this.pendingAdminAmounts.set(this.getPendingAdminKey(entry.promptChatId, entry.adminUserId), entry);
    if (entry.promptMessageId) {
      this.pendingAdminAmounts.set(this.getPendingAdminMsgKey(entry.promptChatId, entry.promptMessageId), entry);
    }
  }

  private resolvePendingAdminInput(
    chatId: string,
    adminUserId: string,
    replyToId: number | null
  ): PendingAdminAmountInput | undefined {
    if (replyToId) {
      const byMsg = this.pendingAdminAmounts.get(this.getPendingAdminMsgKey(chatId, replyToId));
      if (byMsg) return byMsg;
    }
    return this.pendingAdminAmounts.get(this.getPendingAdminKey(chatId, adminUserId));
  }

  private clearPendingAdminInput(entry: PendingAdminAmountInput) {
    const latestKey = this.getPendingAdminKey(entry.promptChatId, entry.adminUserId);
    const curLatest = this.pendingAdminAmounts.get(latestKey);
    if (curLatest && curLatest.txId === entry.txId && curLatest.mode === entry.mode) {
      this.pendingAdminAmounts.delete(latestKey);
    }
    if (entry.promptMessageId) {
      this.pendingAdminAmounts.delete(this.getPendingAdminMsgKey(entry.promptChatId, entry.promptMessageId));
    }
  }

  private async editAllGroupMessagesResolved(
    tx: {
      admin_group_messages?: AdminGroupMessageRef[];
      admin_group_id: string | null;
      admin_group_message_id: number | null;
    },
    fallbackChatId: string,
    fallbackMsgId: number | null,
    hasPhoto: boolean,
    originalTextOrCaption: string,
    suffix: string
  ) {
    const targets: AdminGroupMessageRef[] = [];
    const seen = new Set<string>();
    const addTarget = (cId: string | null | undefined, mId: number | null | undefined) => {
      if (!cId || !mId) return;
      const key = `${cId}::${mId}`;
      if (!seen.has(key)) {
        seen.add(key);
        targets.push({ chat_id: String(cId), message_id: Number(mId) });
      }
    };

    for (const ref of tx.admin_group_messages || []) {
      addTarget(ref.chat_id, ref.message_id);
    }
    addTarget(tx.admin_group_id, tx.admin_group_message_id);
    addTarget(fallbackChatId, fallbackMsgId);

    for (const ref of targets) {
      if (hasPhoto) {
        await this.callApi('editMessageCaption', {
          chat_id: ref.chat_id,
          message_id: ref.message_id,
          caption: `${originalTextOrCaption}${suffix}`,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [] },
        });
      } else {
        await this.callApi('editMessageText', {
          chat_id: ref.chat_id,
          message_id: ref.message_id,
          text: `${originalTextOrCaption}${suffix}`,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [] },
        });
      }
    }
  }

  private async processPendingAdminAmountReply(
    chatId: string,
    messageId: number,
    pending: PendingAdminAmountInput,
    text: string
  ) {
    const cleaned = text.replace(/[, ]+/g, '').replace(/birr|br|etb/gi, '');
    const amount = Number(cleaned);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        reply_to_message_id: messageId,
        text: 'Please type a valid positive Birr number (for example: 100).',
      });
      return;
    }

    const roundedAmt = Math.round(amount * 100) / 100;
    const tx = await supabaseStore.getTransaction(pending.txId);
    this.clearPendingAdminInput(pending);

    if (!tx) {
      await this.callApi('sendMessage', { chat_id: chatId, text: 'Transaction record not found.' });
      return;
    }

    const bankLabel = getCanonicalBankName(tx.bank_key, tx.button_label);
    const playerRawId = tx.player_id.replace(/^tg_/, '');
    const playerFullId = tx.player_id.startsWith('tg_') ? tx.player_id : `tg_${tx.player_id}`;

    if (pending.mode === 'deposit_accept') {
      if (tx.status !== 'pending') {
        await this.callApi('sendMessage', { chat_id: chatId, text: 'This deposit was already processed.' });
        return;
      }

      await this.hub.creditDepositFromBot(playerFullId, tx.player_name, roundedAmt, true);

      let voucherBonusBirr = 0;
      let appliedVoucherCode: string | null = null;
      if (tx.voucher_code) {
        const voucher = await supabaseStore.getActiveVoucherByCode(tx.voucher_code);
        if (voucher) {
          appliedVoucherCode = voucher.code;
          voucherBonusBirr = Math.max(0, Number(voucher.bonus_birr) || 0);
          await supabaseStore.recordVoucherDepositUse(voucher.code, roundedAmt);
          if (voucherBonusBirr > 0) {
            await this.hub.creditDepositFromBot(playerFullId, tx.player_name, voucherBonusBirr, false);
          }
        }
      }

      await supabaseStore.updateTransaction(tx.id, {
        status: 'accepted',
        amount_birr: roundedAmt,
        resolved_by: pending.adminName,
        resolved_at: new Date().toISOString(),
      });

      const voucherSuffix = appliedVoucherCode
        ? ` (+${voucherBonusBirr} Birr Voucher ${escapeHtml(appliedVoucherCode)})`
        : '';
      const suffix = `\n\n✅ <b>ACCEPTED (${escapeHtml(bankLabel)}): +${roundedAmt} Birr${voucherSuffix}</b> · by ${escapeHtml(pending.adminName)}`;
      await this.editAllGroupMessagesResolved(
        tx,
        pending.groupChatId,
        pending.originalGroupMsgId,
        pending.hasPhoto,
        pending.originalTextOrCaption,
        suffix
      );

      await this.callApi('sendMessage', {
        chat_id: chatId,
        reply_to_message_id: messageId,
        text: `✅ Credited <b>${roundedAmt} Birr</b>${voucherSuffix} via <b>${escapeHtml(bankLabel)}</b> to ${escapeHtml(tx.player_name)}.`,
        parse_mode: 'HTML',
      });

      const playerSession = await supabaseStore.getBotSession(playerRawId);
      const playerLang = this.hub.getPlayerLanguage(playerFullId) || playerSession.language || 'en';
      const templates = await supabaseStore.getBotTemplates();
      const tpl = this.findTemplate(templates, 'deposit_accepted', playerLang);
      const localizedBank = getLocalizedBankName(
        (tx.bank_key as PresetBankKey) || 'telebirr',
        playerLang,
        bankLabel
      );
      const userMsg = tpl?.message_text?.trim()
        ? escapeHtml(
            interpolateTemplate(tpl.message_text, {
              amount: roundedAmt,
              bank: localizedBank,
              bonus: voucherBonusBirr,
              code: appliedVoucherCode || '',
            })
          )
        : `✅ ${escapeHtml(BOT_STRINGS[playerLang].depositAcceptedUser(roundedAmt, localizedBank))}` +
          (appliedVoucherCode && voucherBonusBirr > 0
            ? BOT_STRINGS[playerLang].depositAcceptedVoucherLine(escapeHtml(appliedVoucherCode), voucherBonusBirr)
            : '');

      await this.callApi('sendMessage', {
        chat_id: playerRawId,
        text: userMsg,
        parse_mode: 'HTML',
      });

      // Referral first qualifying deposit bonuses (>= 100 Birr tier, or >= 50 Birr tier)
      if (roundedAmt >= 100) {
        const referral = await supabaseStore.getReferralByReferredId(playerFullId);
        if (referral && !referral.deposit_bonus_paid) {
          const { config } = await supabaseStore.getBotConfigAndButtons();
          const depositBonus = Math.max(0, Number(config.referralDepositBonus || 0));
          const updatedRef = await supabaseStore.markReferralDepositBonusPaid(
            playerFullId,
            depositBonus,
            roundedAmt
          );
          if (updatedRef && depositBonus > 0) {
            await this.hub.creditDepositFromBot(referral.referrer_id, referral.referrer_name, depositBonus, false);
            const referrerRawId = referral.referrer_id.replace(/^tg_/, '');
            const refSession = await supabaseStore.getBotSession(referrerRawId);
            const refLang = this.hub.getPlayerLanguage(referral.referrer_id) || refSession.language || 'en';
            await this.callApi('sendMessage', {
              chat_id: referrerRawId,
              text: BOT_STRINGS[refLang].referralDepositNotify(tx.player_name, roundedAmt, depositBonus, 100),
              parse_mode: 'HTML',
            });
          }
        }
      } else if (roundedAmt >= 50) {
        const referral = await supabaseStore.getReferralByReferredId(playerFullId);
        if (referral && !referral.deposit_50_bonus_paid && !referral.deposit_bonus_paid) {
          const { config } = await supabaseStore.getBotConfigAndButtons();
          const deposit50Bonus = Math.max(0, Number(config.referralDeposit50Bonus || 0));
          const updatedRef = await supabaseStore.markReferralDeposit50BonusPaid(
            playerFullId,
            deposit50Bonus,
            roundedAmt
          );
          if (updatedRef && deposit50Bonus > 0) {
            await this.hub.creditDepositFromBot(referral.referrer_id, referral.referrer_name, deposit50Bonus, false);
            const referrerRawId = referral.referrer_id.replace(/^tg_/, '');
            const refSession = await supabaseStore.getBotSession(referrerRawId);
            const refLang = this.hub.getPlayerLanguage(referral.referrer_id) || refSession.language || 'en';
            await this.callApi('sendMessage', {
              chat_id: referrerRawId,
              text: BOT_STRINGS[refLang].referralDepositNotify(tx.player_name, roundedAmt, deposit50Bonus, 50),
              parse_mode: 'HTML',
            });
          }
        }
      }
      return;
    }

    if (pending.mode === 'withdraw_done') {
      if (tx.amount_birr !== null) {
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: `This withdrawal (${tx.amount_birr} Birr) was already recorded.`,
        });
        return;
      }
      const updatedWallet = await this.hub.deductWithdrawFromBot(playerFullId, tx.player_name, roundedAmt);
      await supabaseStore.updateTransaction(tx.id, {
        status: 'done',
        amount_birr: roundedAmt,
        resolved_by: pending.adminName,
        resolved_at: tx.resolved_at || new Date().toISOString(),
      });

      const suffix = `\n\n✅ <b>DONE (${escapeHtml(bankLabel)}): -${roundedAmt} Birr sent</b> · by ${escapeHtml(pending.adminName)}`;
      await this.editAllGroupMessagesResolved(
        tx,
        pending.groupChatId,
        pending.originalGroupMsgId,
        pending.hasPhoto,
        pending.originalTextOrCaption,
        suffix
      );

      await this.callApi('sendMessage', {
        chat_id: chatId,
        reply_to_message_id: messageId,
        text: `✅ Logged <b>${roundedAmt} Birr</b> withdrawal via <b>${escapeHtml(bankLabel)}</b> for ${escapeHtml(tx.player_name)} (Remaining balance: ${updatedWallet.depositedBalance + updatedWallet.wonBalance} Birr).`,
        parse_mode: 'HTML',
      });
    }
  }

  private async maybeProcessReferralJoin(
    tgUserId: string,
    fullName: string,
    username: string | undefined,
    referrerTgId: string,
    wasAlreadyPlayer: boolean
  ) {
    if (!referrerTgId || referrerTgId === tgUserId || !/^\d+$/.test(referrerTgId)) return;
    if (wasAlreadyPlayer) return;

    const referredFullId = `tg_${tgUserId}`;
    const existingRef = await supabaseStore.getReferralByReferredId(referredFullId);
    if (existingRef) return;

    const referrerFullId = `tg_${referrerTgId}`;
    const [refInfo, { config }] = await Promise.all([
      supabaseStore.getPlayerInfo(referrerFullId),
      supabaseStore.getBotConfigAndButtons(),
    ]);
    const referrerName =
      this.hub.getPlayerName(referrerFullId) || refInfo.name || `Player ${referrerTgId}`;
    const signupBonus = Math.max(0, Number(config.referralSignupBonus || 0));
    const deposit50Bonus = Math.max(0, Number(config.referralDeposit50Bonus || 0));
    const depositBonus = Math.max(0, Number(config.referralDepositBonus || 0));

    const created = await supabaseStore.createReferral({
      referrerId: referrerFullId,
      referrerName,
      referrerUsername: refInfo.username || null,
      referredId: referredFullId,
      referredName: fullName,
      referredUsername: username || null,
      signupBonusBirr: signupBonus,
    });

    if (!created) return;

    if (signupBonus > 0) {
      await this.hub.creditDepositFromBot(referrerFullId, referrerName, signupBonus, false);
    }
    this.hub.recordInviteMission?.(referrerFullId);

    const refSession = await supabaseStore.getBotSession(referrerTgId);
    const refLang = this.hub.getPlayerLanguage(referrerFullId) || refSession.language || 'en';
    await this.callApi('sendMessage', {
      chat_id: referrerTgId,
      text: BOT_STRINGS[refLang].referralJoinedNotify(fullName, signupBonus, deposit50Bonus, depositBonus),
      parse_mode: 'HTML',
    });
  }

  public async processPendingBroadcasts() {
    if (!this.botToken || this.isProcessingBroadcasts) return;
    this.isProcessingBroadcasts = true;
    try {
      const pendingList = await supabaseStore.fetchPendingBroadcasts();
      if (pendingList.length === 0) return;

      for (const job of pendingList) {
        const segment = job.segment || 'all';
        const recipients = await supabaseStore.listSegmentedTelegramUserIds(this.hub.getAllPlayerIds(), segment);
        await supabaseStore.updateBroadcast(job.id, {
          status: 'sending',
          total_count: recipients.length,
        });

        const formattedMessage = decorateSeasonalBroadcast(job.message_text, job.season_theme || 'none');
        let sentCount = 0;
        let failedCount = 0;

        for (const recipientId of recipients) {
          let res = await this.callApi('sendMessage', {
            chat_id: recipientId,
            text: formattedMessage,
            parse_mode: 'HTML',
          });
          if (!res?.ok && res?.parameters?.retry_after) {
            await new Promise((r) => setTimeout(r, (Number(res?.parameters?.retry_after) + 1) * 1000));
            res = await this.callApi('sendMessage', {
              chat_id: recipientId,
              text: formattedMessage,
              parse_mode: 'HTML',
            });
          }
          if (res?.ok) {
            sentCount += 1;
          } else {
            failedCount += 1;
          }
          // Gentle rate-limit spacing (~22 msgs/sec)
          await new Promise((resolve) => setTimeout(resolve, 45));
        }

        await supabaseStore.updateBroadcast(job.id, {
          status: 'completed',
          total_count: recipients.length,
          sent_count: sentCount,
          failed_count: failedCount,
          completed_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('[Broadcast Worker Error]:', err);
    } finally {
      this.isProcessingBroadcasts = false;
    }
  }

  public async handleUpdate(update: Record<string, any>, fallbackAppUrl: string) {
    const miniAppBaseUrl = this.resolveMiniAppUrl(fallbackAppUrl);

    if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query, miniAppBaseUrl);
      return;
    }

    const message = update.message;
    if (!message || !message.chat || !message.from) return;

    const chatId = String(message.chat.id);
    const chatType = String(message.chat.type || 'private');
    const from = message.from as {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      is_bot?: boolean;
    };
    if (from.is_bot) return;

    const tgUserId = String(from.id);
    const fullName =
      [from.first_name, from.last_name].filter(Boolean).join(' ').trim() ||
      from.username ||
      `Player ${from.id}`;
    const text = typeof message.text === 'string' ? message.text.trim() : '';

    // Group / Supergroup messages (Admin Group commands & Deposit/Withdrawal amount input)
    if (chatType === 'group' || chatType === 'supergroup') {
      if (text.startsWith('/setgroup')) {
        const isAllowed = await this.isTelegramGroupAdmin(chatId, from.id, chatType);
        if (!isAllowed) {
          await this.callApi('sendMessage', {
            chat_id: chatId,
            text: 'Only a group admin can link this Admin Group.',
          });
          return;
        }
        await supabaseStore.setAdminGroupId(chatId);
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: `✅ <b>Admin Group Linked!</b>\nGroup ID: <code>${escapeHtml(chatId)}</code>\nAll player Deposit and Withdrawal requests will be sent here.`,
          parse_mode: 'HTML',
        });
        return;
      }

      const replyToId = message.reply_to_message?.message_id ? Number(message.reply_to_message.message_id) : null;
      const pending = this.resolvePendingAdminInput(chatId, tgUserId, replyToId);

      if (pending && text && !text.startsWith('/')) {
        await this.processPendingAdminAmountReply(chatId, message.message_id, pending, text);
        return;
      }
      return;
    }

    // Private Chat Messages
    if (chatType !== 'private') return;

    // Check if an admin is replying in DM to a channel-triggered amount prompt
    const dmReplyToId = message.reply_to_message?.message_id ? Number(message.reply_to_message.message_id) : null;
    const dmPending = this.resolvePendingAdminInput(chatId, tgUserId, dmReplyToId);
    if (dmPending && text && !text.startsWith('/')) {
      await this.processPendingAdminAmountReply(chatId, message.message_id, dmPending, text);
      return;
    }

    const playerFullId = `tg_${tgUserId}`;
    const refMatch = text.match(/^\/start(?:@\S+)?\s+ref_(\d+)/i);
    const [playerInfo, session] = await Promise.all([
      supabaseStore.getPlayerInfo(playerFullId),
      supabaseStore.getBotSession(tgUserId),
    ]);
    const wasAlreadyPlayer = this.hub.hasPlayer(playerFullId) || playerInfo.exists;
    const lang: AppLanguage = this.hub.getPlayerLanguage(playerFullId) || session.language || 'en';
    const t = BOT_STRINGS[lang];

    if (this.hub.isPlayerBanned(playerFullId) || playerInfo.isBanned) {
      const templates = await supabaseStore.getBotTemplates();
      const bannedTpl = this.findTemplate(templates, 'banned_notice', lang);
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: escapeHtml(bannedTpl?.message_text?.trim() || t.bannedNotice),
      });
      return;
    }

    // Ensure Telegram account name & username are always synced into Hub & Supabase
    this.hub.getWalletSnapshot(playerFullId, fullName, from.username);

    if (refMatch) {
      await this.maybeProcessReferralJoin(tgUserId, fullName, from.username, refMatch[1], wasAlreadyPlayer);
    }

    // Handle native Telegram Share Contact response
    if (message.contact && message.contact.phone_number) {
      await supabaseStore.savePlayerContact(
        playerFullId,
        String(message.contact.phone_number),
        fullName,
        from.username
      );
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: t.contactSaved,
        reply_markup: { remove_keyboard: true },
      });
      await this.sendHomeMenu(chatId, tgUserId, fullName, from.username, lang, miniAppBaseUrl);
      return;
    }

    if (text.startsWith('/start') || text.startsWith('/play')) {
      session.pending_action = null;
      session.selected_button_id = null;
      session.selected_button_label = null;
      session.selected_bank_key = null;
      session.temp_voucher_code = null;
      session.language = lang;
      await supabaseStore.saveBotSession(session);

      // On first start when contact hasn't been shared yet, prompt user to share their Telegram contact
      if (text.startsWith('/start') && !playerInfo.contactShared) {
        const templates = await supabaseStore.getBotTemplates();
        await this.sendContactPrompt(chatId, fullName, lang, templates);
        return;
      }

      await this.sendHomeMenu(chatId, tgUserId, fullName, from.username, lang, miniAppBaseUrl);
      return;
    }

    if (text.startsWith('/deposit')) {
      session.pending_action = null;
      session.temp_voucher_code = null;
      await supabaseStore.saveBotSession(session);
      await this.sendDepositMenu(chatId, lang, miniAppBaseUrl);
      return;
    }

    if (text.startsWith('/withdraw')) {
      session.pending_action = null;
      session.temp_voucher_code = null;
      await supabaseStore.saveBotSession(session);
      await this.sendWithdrawMenu(chatId, lang, miniAppBaseUrl);
      return;
    }

    if (text.startsWith('/referral')) {
      session.pending_action = null;
      await supabaseStore.saveBotSession(session);
      await this.sendReferralMenu(chatId, tgUserId, lang, miniAppBaseUrl);
      return;
    }

    if (text.startsWith('/language')) {
      await this.sendLanguageMenu(chatId, lang);
      return;
    }

    // Custom slash command handler matching bot_text_templates (e.g., /promo, /rules)
    if (text.startsWith('/')) {
      const cmdKey = text.slice(1).split(/[\s@]+/)[0].toLowerCase();
      if (cmdKey) {
        const handled = await this.sendCustomTemplateNode(
          chatId,
          tgUserId,
          fullName,
          from.username,
          lang,
          miniAppBaseUrl,
          cmdKey
        );
        if (handled) return;
      }
    }

    // Voucher code entry step before showing bank details
    if (session.pending_action === 'awaiting_deposit_voucher') {
      const voucher = text ? await supabaseStore.getActiveVoucherByCode(text) : null;
      if (!voucher) {
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: t.voucherInvalid,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: t.btnSkipVoucher, callback_data: 'dep_skip_voucher' }],
              [{ text: `❌ ${t.btnCancel}`, callback_data: 'menu:cancel' }],
            ],
          },
        });
        return;
      }

      session.temp_voucher_code = voucher.code;
      session.pending_action = 'awaiting_deposit_proof';
      await supabaseStore.saveBotSession(session);

      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: t.voucherApplied(escapeHtml(voucher.code), voucher.bonus_birr),
        parse_mode: 'HTML',
      });

      const { buttons } = await supabaseStore.getBotConfigAndButtons();
      const btn = buttons.find(
        (b) => b.flow_type === 'deposit' && b.bank_key === session.selected_bank_key
      );
      if (btn) {
        await this.sendSelectedBankDepositInstructions(chatId, lang, btn);
      }
      return;
    }

    if (
      session.pending_action === 'awaiting_deposit_proof' ||
      session.pending_action === 'awaiting_withdraw_info'
    ) {
      const photos = Array.isArray(message.photo) ? message.photo : [];
      const largestPhoto = photos.length > 0 ? photos[photos.length - 1] : null;
      const photoFileId: string | null = largestPhoto?.file_id ? String(largestPhoto.file_id) : null;
      const userMessageText: string | null =
        (typeof message.text === 'string' && message.text.trim()) ||
        (typeof message.caption === 'string' && message.caption.trim()) ||
        null;

      if (!photoFileId && !userMessageText) return;

      const [{ config }, templates] = await Promise.all([
        supabaseStore.getBotConfigAndButtons(),
        supabaseStore.getBotTemplates(),
      ]);
      const targetGroupIds = supabaseStore.getAllTargetGroupIds(config);
      if (targetGroupIds.length === 0) {
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: t.adminGroupNotConfigured,
        });
        return;
      }

      const txType = session.pending_action === 'awaiting_deposit_proof' ? 'deposit' : 'withdraw';
      const canonicalBank = getCanonicalBankName(session.selected_bank_key, session.selected_button_label);
      const appliedVoucher = txType === 'deposit' ? session.temp_voucher_code : null;

      const tx = await supabaseStore.createTransaction({
        playerId: playerFullId,
        playerName: fullName,
        playerUsername: from.username || null,
        txType,
        bankKey: session.selected_bank_key,
        buttonId: session.selected_button_id,
        buttonLabel: canonicalBank,
        userMessage: userMessageText,
        userPhotoFileId: photoFileId,
        adminGroupId: targetGroupIds[0],
        voucherCode: appliedVoucher,
      });

      session.pending_action = null;
      session.selected_button_id = null;
      session.selected_button_label = null;
      session.selected_bank_key = null;
      session.temp_voucher_code = null;
      await supabaseStore.saveBotSession(session);

      const wallet = this.hub.getWalletSnapshot(playerFullId, fullName, from.username);
      const userHandle = from.username ? `@${from.username}` : 'No username';
      const headerLabel = txType === 'deposit' ? '💰 <b>NEW DEPOSIT REQUEST</b>' : '💸 <b>NEW WITHDRAWAL REQUEST</b>';
      const detailsBlock =
        `${headerLabel}\n` +
        `Player: <b>${escapeHtml(fullName)}</b> (${escapeHtml(userHandle)})\n` +
        `Telegram ID: <code>${escapeHtml(tgUserId)}</code>\n` +
        `Bank: <b>${escapeHtml(canonicalBank)}</b>\n` +
        (appliedVoucher ? `Voucher: 🎫 <code>${escapeHtml(appliedVoucher)}</code>\n` : '') +
        `Balance: <b>${wallet.depositedBalance + wallet.wonBalance} Birr</b> (Dep: ${wallet.depositedBalance} · Won: ${wallet.wonBalance})` +
        (userMessageText ? `\nMessage: ${escapeHtml(userMessageText)}` : '');

      const adminKeyboard =
        txType === 'deposit'
          ? [
              [
                { text: '✅ Accept', callback_data: `adm_da:${tx.id}` },
                { text: '❌ Reject', callback_data: `adm_dr:${tx.id}` },
              ],
            ]
          : [
              [
                { text: '✅ Done', callback_data: `adm_wd:${tx.id}` },
                { text: '⚠️ Incorrect Info', callback_data: `adm_wb:${tx.id}` },
              ],
            ];

      const sentRefs: AdminGroupMessageRef[] = [];
      for (const targetChatId of targetGroupIds) {
        let sentRes: any = null;
        if (photoFileId) {
          sentRes = await this.callApi('sendPhoto', {
            chat_id: targetChatId,
            photo: photoFileId,
            caption: detailsBlock,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: adminKeyboard },
          });
        } else {
          sentRes = await this.callApi('sendMessage', {
            chat_id: targetChatId,
            text: detailsBlock,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: adminKeyboard },
          });
        }
        if (sentRes?.result?.message_id) {
          sentRefs.push({
            chat_id: targetChatId,
            message_id: Number(sentRes.result.message_id),
          });
        }
      }

      if (sentRefs.length > 0) {
        await supabaseStore.updateTransaction(tx.id, {
          admin_group_message_id: sentRefs[0].message_id,
          admin_group_messages: sentRefs,
        });
      }

      const confirmTpl = this.findTemplate(
        templates,
        txType === 'deposit' ? 'deposit_received' : 'withdraw_received',
        lang
      );
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: confirmTpl?.message_text?.trim() || (txType === 'deposit' ? t.depositReceived : t.withdrawReceived),
      });
      return;
    }

    await this.sendHomeMenu(chatId, tgUserId, fullName, from.username, lang, miniAppBaseUrl);
  }

  private async handleCallbackQuery(cq: Record<string, any>, miniAppBaseUrl: string) {
    const cqId = String(cq.id);
    const data = String(cq.data || '');
    const msg = cq.message;
    const from = cq.from as {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };

    if (!msg || !msg.chat || !from) {
      await this.callApi('answerCallbackQuery', { callback_query_id: cqId });
      return;
    }

    const chatId = String(msg.chat.id);
    const chatType = String(msg.chat.type || 'private');
    const msgId = Number(msg.message_id);
    const tgUserId = String(from.id);
    const fullName =
      [from.first_name, from.last_name].filter(Boolean).join(' ').trim() ||
      from.username ||
      `Player ${from.id}`;

    // Admin Group / Channel Button Actions
    if (data.startsWith('adm_')) {
      if (chatType !== 'group' && chatType !== 'supergroup' && chatType !== 'channel') {
        await this.callApi('answerCallbackQuery', { callback_query_id: cqId });
        return;
      }

      const isAllowed = await this.isTelegramGroupAdmin(chatId, from.id, chatType);
      if (!isAllowed) {
        await this.callApi('answerCallbackQuery', {
          callback_query_id: cqId,
          text: 'Only admins can approve or reject requests.',
          show_alert: true,
        });
        return;
      }

      const [action, txId] = data.split(':');
      const tx = await supabaseStore.getTransaction(txId);
      if (!tx) {
        await this.callApi('answerCallbackQuery', {
          callback_query_id: cqId,
          text: 'Request record not found.',
          show_alert: true,
        });
        return;
      }
      if (tx.status !== 'pending') {
        await this.callApi('answerCallbackQuery', {
          callback_query_id: cqId,
          text: `Already marked as ${tx.status}.`,
        });
        return;
      }

      const hasPhoto = Boolean(msg.photo && msg.photo.length > 0);
      const origContent = escapeHtml(String(hasPhoto ? msg.caption || '' : msg.text || ''));
      const bankLabel = getCanonicalBankName(tx.bank_key, tx.button_label);
      const playerRawId = tx.player_id.replace(/^tg_/, '');
      const playerFullId = tx.player_id.startsWith('tg_') ? tx.player_id : `tg_${tx.player_id}`;
      const [playerSession, templates] = await Promise.all([
        supabaseStore.getBotSession(playerRawId),
        supabaseStore.getBotTemplates(),
      ]);
      const playerLang = this.hub.getPlayerLanguage(playerFullId) || playerSession.language || 'en';
      const pt = BOT_STRINGS[playerLang];

      const promptChatId = chatType === 'channel' ? tgUserId : chatId;

      if (action === 'adm_da') {
        await this.callApi('answerCallbackQuery', {
          callback_query_id: cqId,
          text: chatType === 'channel' ? 'Check your private chat with the bot to enter the Birr amount.' : undefined,
        });
        const promptRes = await this.callApi('sendMessage', {
          chat_id: promptChatId,
          reply_to_message_id: chatType === 'channel' ? undefined : msgId,
          text:
            `💵 How much Birr was deposited via <b>${escapeHtml(bankLabel)}</b> for <b>${escapeHtml(tx.player_name)}</b>?` +
            (tx.voucher_code ? `\n🎫 Voucher attached: <code>${escapeHtml(tx.voucher_code)}</code>` : '') +
            `\nType the number below:`,
          parse_mode: 'HTML',
          reply_markup: { force_reply: true, selective: true },
        });
        this.setPendingAdminInput({
          mode: 'deposit_accept',
          txId: tx.id,
          groupChatId: chatId,
          promptChatId,
          adminUserId: tgUserId,
          adminName: fullName,
          promptMessageId: promptRes?.result?.message_id ? Number(promptRes.result.message_id) : null,
          originalGroupMsgId: msgId,
          hasPhoto,
          originalTextOrCaption: origContent,
        });
        return;
      }

      if (action === 'adm_dr') {
        await this.callApi('answerCallbackQuery', { callback_query_id: cqId, text: 'Rejected' });
        await supabaseStore.updateTransaction(tx.id, {
          status: 'rejected',
          resolved_by: fullName,
          resolved_at: new Date().toISOString(),
        });
        const suffix = `\n\n❌ <b>REJECTED (${escapeHtml(bankLabel)})</b> · by ${escapeHtml(fullName)}`;
        await this.editAllGroupMessagesResolved(tx, chatId, msgId, hasPhoto, origContent, suffix);
        const rejTpl = this.findTemplate(templates, 'deposit_rejected', playerLang);
        await this.callApi('sendMessage', {
          chat_id: playerRawId,
          text: `❌ ${rejTpl?.message_text?.trim() || pt.depositRejectedUser}`,
        });
        return;
      }

      if (action === 'adm_wd') {
        await this.callApi('answerCallbackQuery', {
          callback_query_id: cqId,
          text: chatType === 'channel' ? 'Marked Done! Check DM to enter amount.' : 'Marked Done',
        });
        await supabaseStore.updateTransaction(tx.id, {
          status: 'done',
          resolved_by: fullName,
          resolved_at: new Date().toISOString(),
        });

        const wdDoneTpl = this.findTemplate(templates, 'withdraw_done', playerLang);
        await this.callApi('sendMessage', {
          chat_id: playerRawId,
          text: `✅ ${wdDoneTpl?.message_text?.trim() || pt.withdrawDoneUser}`,
        });

        const promptRes = await this.callApi('sendMessage', {
          chat_id: promptChatId,
          reply_to_message_id: chatType === 'channel' ? undefined : msgId,
          text: `💵 Marked Done & notified ${escapeHtml(tx.player_name)}!\nHow much Birr did you send via <b>${escapeHtml(bankLabel)}</b>? Type the number below to record & deduct:`,
          parse_mode: 'HTML',
          reply_markup: { force_reply: true, selective: true },
        });
        this.setPendingAdminInput({
          mode: 'withdraw_done',
          txId: tx.id,
          groupChatId: chatId,
          promptChatId,
          adminUserId: tgUserId,
          adminName: fullName,
          promptMessageId: promptRes?.result?.message_id ? Number(promptRes.result.message_id) : null,
          originalGroupMsgId: msgId,
          hasPhoto,
          originalTextOrCaption: origContent,
        });
        return;
      }

      if (action === 'adm_wb') {
        await this.callApi('answerCallbackQuery', { callback_query_id: cqId, text: 'Marked Incorrect Info' });
        await supabaseStore.updateTransaction(tx.id, {
          status: 'incorrect',
          resolved_by: fullName,
          resolved_at: new Date().toISOString(),
        });
        const suffix = `\n\n⚠️ <b>INCORRECT INFO (${escapeHtml(bankLabel)})</b> · by ${escapeHtml(fullName)}`;
        await this.editAllGroupMessagesResolved(tx, chatId, msgId, hasPhoto, origContent, suffix);
        const wdErrTpl = this.findTemplate(templates, 'withdraw_incorrect', playerLang);
        await this.callApi('sendMessage', {
          chat_id: playerRawId,
          text: `⚠️ ${wdErrTpl?.message_text?.trim() || pt.withdrawIncorrectUser}`,
        });
        return;
      }

      await this.callApi('answerCallbackQuery', { callback_query_id: cqId });
      return;
    }

    // Player Private Bot Menu Callbacks
    await this.callApi('answerCallbackQuery', { callback_query_id: cqId });

    const playerFullId = `tg_${tgUserId}`;
    const [session, playerInfo] = await Promise.all([
      supabaseStore.getBotSession(tgUserId),
      supabaseStore.getPlayerInfo(playerFullId),
    ]);
    const lang: AppLanguage = this.hub.getPlayerLanguage(playerFullId) || session.language || 'en';
    const t = BOT_STRINGS[lang];

    if (this.hub.isPlayerBanned(playerFullId) || playerInfo.isBanned) {
      await this.callApi('sendMessage', { chat_id: chatId, text: t.bannedNotice });
      return;
    }

    this.hub.getWalletSnapshot(playerFullId, fullName, from.username);

    if (data === 'menu:home' || data === 'menu:cancel') {
      session.pending_action = null;
      session.selected_button_id = null;
      session.selected_button_label = null;
      session.selected_bank_key = null;
      session.temp_voucher_code = null;
      await supabaseStore.saveBotSession(session);
      await this.sendHomeMenu(chatId, tgUserId, fullName, from.username, lang, miniAppBaseUrl, msgId);
      return;
    }

    if (data === 'menu:deposit') {
      await this.sendDepositMenu(chatId, lang, miniAppBaseUrl, msgId);
      return;
    }

    if (data === 'menu:withdraw') {
      await this.sendWithdrawMenu(chatId, lang, miniAppBaseUrl, msgId);
      return;
    }

    if (data === 'menu:referral') {
      await this.sendReferralMenu(chatId, tgUserId, lang, miniAppBaseUrl, msgId);
      return;
    }

    if (data === 'menu:language' || data === 'menu:lang') {
      await this.sendLanguageMenu(chatId, lang, msgId);
      return;
    }

    if (data.startsWith('tpl:')) {
      const tplKey = data.slice(4);
      await this.sendCustomTemplateNode(chatId, tgUserId, fullName, from.username, lang, miniAppBaseUrl, tplKey, msgId);
      return;
    }

    if (data.startsWith('lang:')) {
      const nextLang = data.slice(5) as AppLanguage;
      if (nextLang === 'en' || nextLang === 'am' || nextLang === 'om') {
        session.language = nextLang;
        session.pending_action = null;
        await supabaseStore.saveBotSession(session);
        this.hub.setPlayerLanguage(playerFullId, nextLang);
        await supabaseStore.setPlayerLanguage(playerFullId, nextLang);
        await this.sendHomeMenu(chatId, tgUserId, fullName, from.username, nextLang, miniAppBaseUrl, msgId);
      }
      return;
    }

    if (data === 'dep_skip_voucher') {
      if (!session.selected_bank_key) {
        await this.sendDepositMenu(chatId, lang, miniAppBaseUrl, msgId);
        return;
      }
      session.temp_voucher_code = null;
      session.pending_action = 'awaiting_deposit_proof';
      await supabaseStore.saveBotSession(session);
      const { buttons } = await supabaseStore.getBotConfigAndButtons();
      const btn = buttons.find((b) => b.flow_type === 'deposit' && b.bank_key === session.selected_bank_key);
      if (btn) {
        await this.sendSelectedBankDepositInstructions(chatId, lang, btn);
      }
      return;
    }

    if (data.startsWith('dep:')) {
      const bankKey = data.slice(4) as PresetBankKey;
      const [{ config, buttons }, templates] = await Promise.all([
        supabaseStore.getBotConfigAndButtons(),
        supabaseStore.getBotTemplates(),
      ]);
      const btn: PaymentButtonRecord | undefined = buttons.find(
        (b) => b.flow_type === 'deposit' && b.bank_key === bankKey
      );
      if (!btn) {
        await this.sendDepositMenu(chatId, lang, miniAppBaseUrl, msgId);
        return;
      }
      const displayBank = getLocalizedBankName(btn.bank_key, lang, btn.label);
      session.selected_button_id = btn.id;
      session.selected_button_label = getCanonicalBankName(btn.bank_key, btn.label);
      session.selected_bank_key = btn.bank_key;
      session.temp_voucher_code = null;

      if (config.vouchersEnabled) {
        session.pending_action = 'awaiting_deposit_voucher';
        await supabaseStore.saveBotSession(session);
        const voucherTpl = this.findTemplate(templates, 'voucher_prompt', lang);
        const promptText = voucherTpl?.message_text?.trim()
          ? escapeHtml(interpolateTemplate(voucherTpl.message_text, { bank: displayBank }))
          : t.voucherPrompt(escapeHtml(displayBank));
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: promptText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: t.btnSkipVoucher, callback_data: 'dep_skip_voucher' }],
              [{ text: `❌ ${t.btnCancel}`, callback_data: 'menu:cancel' }],
            ],
          },
        });
        return;
      }

      session.pending_action = 'awaiting_deposit_proof';
      await supabaseStore.saveBotSession(session);
      await this.sendSelectedBankDepositInstructions(chatId, lang, btn);
      return;
    }

    if (data.startsWith('wd:')) {
      const bankKey = data.slice(3) as PresetBankKey;
      const [{ config, buttons }, templates] = await Promise.all([
        supabaseStore.getBotConfigAndButtons(),
        supabaseStore.getBotTemplates(),
      ]);
      const btn: PaymentButtonRecord | undefined = buttons.find(
        (b) => b.flow_type === 'withdraw' && b.bank_key === bankKey
      );
      if (!btn) {
        await this.sendWithdrawMenu(chatId, lang, miniAppBaseUrl, msgId);
        return;
      }
      const displayBank = getLocalizedBankName(btn.bank_key, lang, btn.label);
      session.pending_action = 'awaiting_withdraw_info';
      session.selected_button_id = btn.id;
      session.selected_button_label = getCanonicalBankName(btn.bank_key, btn.label);
      session.selected_bank_key = btn.bank_key;
      session.temp_voucher_code = null;
      await supabaseStore.saveBotSession(session);

      const wdPromptTpl = this.findTemplate(templates, 'withdraw_prompt', lang);
      const rawReply = btn.response_text.trim() || wdPromptTpl?.message_text?.trim() || config.withdrawPromptText;
      const formatted = formatMessageWithCopyable(rawReply, btn.copyable_text);
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `<b>${escapeHtml(displayBank)}</b>\n\n${formatted}`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: `❌ ${t.btnCancel}`, callback_data: 'menu:cancel' }]],
        },
      });
    }
  }
}
