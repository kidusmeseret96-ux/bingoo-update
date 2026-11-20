import { AppLanguage } from '../../shared/bingo';

export interface Translations {
  brandName: string;
  chooseStake: string;
  liveHall: string;
  winners: string;
  settings: string;
  adminControls: string;
  welcome: string;
  online: string;
  reconnecting: string;
  changeStake: string;
  birr: string;
  room: string;
  round: string;
  cartelas: string;
  players: string;
  pool: string;
  betPoolNet: string;
  deposited: string;
  won: string;
  insufficientBalance: string;
  lobbyTitle: string;
  enterRoom: string;
  paused: string;
  nextIn: string;
  selectionOpen: string;
  pickBeforeZero: string;
  sec: string;
  timerExplain: string;
  selectCartelaPrefix: string;
  selectionLockedTitle: string;
  selectionLockedHint: string;
  pickAsManyAsBalance: string;
  quickPick: string;
  customNumbers: string;
  closeBuilder: string;
  pickOwnNumbers: string;
  pickOwnHint: string;
  shuffle: string;
  lockCustomCard: string;
  available: string;
  yours: string;
  claimed: string;
  you: string;
  spectatingTitle: string;
  spectatingHint: string;
  callingNow: string;
  waitingFirstBall: string;
  drawnOf75: string;
  recentCalls: string;
  board75Title: string;
  customCartela: string;
  cartelaNum: string;
  swap: string;
  ready: string;
  free: string;
  claimBingo: string;
  checkAndClaim: string;
  winnerBanner: string;
  nextGameStarting: string;
  roundNoWinner: string;
  recentWinnersAll: string;
  roundsInRoom: string;
  noWinnersYet: string;
  leaderboard: string;
  leaderboardEmpty: string;
  winSingular: string;
  winPlural: string;
  settingsTitle: string;
  languageLabel: string;
  themeLabel: string;
  darkMode: string;
  lightMode: string;
  soundEffects: string;
  voiceCaller: string;
  autoMark: string;
  autoMarkDesc: string;
  autoWin: string;
  autoWinDesc: string;
  playerName: string;
  save: string;
  on: string;
  off: string;
  done: string;
  playingAs: string;
  notCalledYet: string;
  pausedByAdmin: string;
  tapForCard: string;
  previewMode: string;
  previewCard: string;
  lockThisCard: string;
  // Quests, Tiers, Special Events, How To Play, Range Search
  missions: string;
  dailyQuests: string;
  claim: string;
  claimedStatus: string;
  allBonusTitle: string;
  allBonusDesc: string;
  noMissionsToday: string;
  vipRank: string;
  nextTierAt: string;
  maxRankReached: string;
  howToPlay: string;
  hideRules: string;
  howToPlaySteps: Array<{ title: string; desc: string }>;
  howToPlayPatternsTitle: string;
  patternRow: string;
  patternCol: string;
  patternDiag: string;
  patternCorners: string;
  specialEvents: string;
  bonusPrize: string;
  minPlayersNeeded: string;
  endsIn: string;
  findCartelaPlaceholder: string;
}

export const TRANSLATIONS: Record<AppLanguage, Translations> = {
  en: {
    brandName: 'Zemen Bingo',
    chooseStake: 'Select Stake',
    liveHall: 'Live Game',
    winners: 'Winners',
    settings: 'Settings',
    adminControls: 'Admin',
    welcome: 'Welcome',
    online: 'online',
    reconnecting: 'Reconnecting...',
    changeStake: 'Back',
    birr: 'Birr',
    room: 'Room',
    round: 'Round',
    cartelas: 'cartelas',
    players: 'Players',
    pool: 'Pool',
    betPoolNet: 'Prize Pool',
    deposited: 'Deposited',
    won: 'Won',
    insufficientBalance: 'Insufficient balance',
    lobbyTitle: 'Select your stake',
    enterRoom: 'Play',
    paused: 'Paused',
    nextIn: 'Next in',
    selectionOpen: 'Selection Open',
    pickBeforeZero: 'Choose Your Cartelas',
    sec: 'sec',
    timerExplain: 'Counts down from 30 to 0, then locks all cards and starts calling.',
    selectCartelaPrefix: 'Pick Cartela',
    selectionLockedTitle: 'Selection Locked',
    selectionLockedHint: 'New 30s selection starts automatically right after this round.',
    pickAsManyAsBalance: 'Pick as many cartelas as your balance allows.',
    quickPick: 'Quick Pick',
    customNumbers: 'Custom',
    closeBuilder: 'Close',
    pickOwnNumbers: 'Build Your Own Cartela',
    pickOwnHint: 'Choose 5 numbers per column (4 for N — center is FREE).',
    shuffle: 'Shuffle',
    lockCustomCard: 'Add Custom Card',
    available: 'Available',
    yours: 'Yours',
    claimed: 'Claimed',
    you: 'You',
    spectatingTitle: 'Watching Live Round',
    spectatingHint: 'Next cartela selection opens right after Bingo.',
    callingNow: 'Calling Now',
    waitingFirstBall: 'Drawing #1...',
    drawnOf75: 'Called',
    recentCalls: 'Recent',
    board75Title: 'All 75 Numbers',
    customCartela: 'Custom',
    cartelaNum: 'Cartela',
    swap: 'Refund',
    ready: 'Bingo Ready!',
    free: 'FREE',
    claimBingo: 'Claim Bingo',
    checkAndClaim: 'Bingo!',
    winnerBanner: 'BINGO! WINNER!',
    nextGameStarting: 'Next game in',
    roundNoWinner: 'Round ended with no winner. Returning to selection...',
    recentWinnersAll: 'Recent Winners',
    roundsInRoom: 'rounds played',
    noWinnersYet: 'No winners recorded yet in this session.',
    leaderboard: 'Top Winners',
    leaderboardEmpty: 'Win any round to appear on the leaderboard.',
    winSingular: 'win',
    winPlural: 'wins',
    settingsTitle: 'Game Settings',
    languageLabel: 'Language & Caller Voice',
    themeLabel: 'Appearance',
    darkMode: 'Dark Mode',
    lightMode: 'Light Mode',
    soundEffects: 'Sound Effects',
    voiceCaller: 'Voice Number Calling',
    autoMark: 'Auto-Mark Numbers',
    autoMarkDesc: 'Automatically stamp called numbers on your cartela',
    autoWin: 'Auto-Win Bingo',
    autoWinDesc: 'Claim automatically when a winning line or corners complete',
    playerName: 'Display Name',
    save: 'Save',
    on: 'On',
    off: 'Off',
    done: 'Done',
    playingAs: 'Playing as',
    notCalledYet: 'has not been called yet.',
    pausedByAdmin: 'Game Paused by Admin',
    tapForCard: 'Card',
    previewMode: 'Preview',
    previewCard: 'Preview Cartela',
    lockThisCard: 'Pick Cartela',
    missions: 'Quests',
    dailyQuests: 'Daily Quests & VIP Rank',
    claim: 'Claim',
    claimedStatus: 'Claimed',
    allBonusTitle: 'Complete All Daily Quests',
    allBonusDesc: 'Finish every task today to unlock the Grand Bonus',
    noMissionsToday: 'No active quests configured right now.',
    vipRank: 'Your VIP Rank',
    nextTierAt: 'Next rank at',
    maxRankReached: 'Max Platinum Rank!',
    howToPlay: 'How to Play',
    hideRules: 'Hide Rules',
    howToPlaySteps: [
      { title: '1. Choose a Stake or Event', desc: 'Tap any Birr room (or Special Event) to enter the live hall.' },
      { title: '2. Pick Your Cartelas (30s)', desc: 'Select one or more cartela numbers before the countdown hits zero. Tap again to refund before lock.' },
      { title: '3. Watch Called Balls (1–75)', desc: 'Numbers draw live in English, Amharic, or Oromo voice. Auto-mark stamps your card automatically.' },
      { title: '4. Claim Bingo & Win Instantly', desc: 'Complete any winning pattern first and receive the Birr prize pool straight into your Won wallet!' },
    ],
    howToPlayPatternsTitle: 'Winning Patterns',
    patternRow: 'Any Row (5)',
    patternCol: 'Any Column (5)',
    patternDiag: 'Diagonal (5)',
    patternCorners: '4 Corners',
    specialEvents: 'Special Events',
    bonusPrize: 'Bonus',
    minPlayersNeeded: 'Min players',
    endsIn: 'Ends in',
    findCartelaPlaceholder: 'Jump #',
  },
  am: {
    brandName: 'ዘመን ቢንጎ',
    chooseStake: 'መደብ ይምረጡ',
    liveHall: 'ቀጥታ ጨዋታ',
    winners: 'አሸናፊዎች',
    settings: 'ቅንብሮች',
    adminControls: 'አስተዳዳሪ',
    welcome: 'እንኳን ደህና መጡ',
    online: 'መስመር ላይ',
    reconnecting: 'በመገናኘት ላይ...',
    changeStake: 'ተመለስ',
    birr: 'ብር',
    room: 'ክፍል',
    round: 'ዙር',
    cartelas: 'ካርቴላዎች',
    players: 'ተጫዋቾች',
    pool: 'ሽልማት',
    betPoolNet: 'የሽልማት ገንዘብ',
    deposited: 'የተቀመጠ',
    won: 'ያሸነፉት',
    insufficientBalance: 'በቂ ሂሳብ የለም',
    lobbyTitle: 'መደብዎን ይምረጡ',
    enterRoom: 'ግባ',
    paused: 'ቆሟል',
    nextIn: 'ቀጣዩ በ',
    selectionOpen: 'ምርጫ ክፍት ነው',
    pickBeforeZero: 'ካርቴላዎን ይምረጡ',
    sec: 'ሰከንድ',
    timerExplain: 'ቆጣሪው ከ30 ወደ 0 ሲደርስ ጨዋታው በራሱ ይጀምራል።',
    selectCartelaPrefix: 'ካርቴላ ይምረጡ',
    selectionLockedTitle: 'ምርጫ ተዘግቷል',
    selectionLockedHint: 'ይህ ዙር ሲያልቅ የ30 ሰከንድ ምርጫ በራሱ ይከፈታል።',
    pickAsManyAsBalance: 'ሂሳብዎ እስከፈቀደ ድረስ የሚፈልጉትን ያህል ካርቴላ ይምረጡ።',
    quickPick: 'በፍጥነት',
    customNumbers: 'በራስ',
    closeBuilder: 'ዝጋ',
    pickOwnNumbers: 'የራስዎን ካርቴላ ይስሩ',
    pickOwnHint: 'በእያንዳንዱ ረድፍ 5 ቁጥር ይምረጡ (ለ N 4 ቁጥር — መሃሉ ነጻ ነው)።',
    shuffle: 'ቀላቅል',
    lockCustomCard: 'ካርቴላውን ጨምር',
    available: 'ያልተያዘ',
    yours: 'የእርስዎ',
    claimed: 'የተያዙ',
    you: 'እርስዎ',
    spectatingTitle: 'ቀጥታ ጨዋታ በመከታተል ላይ',
    spectatingHint: 'ቢንጎ ሲባል ወዲያውኑ ወደ ካርቴላ መምረጫ ይመለሳሉ።',
    callingNow: 'አሁን የተጠራ',
    waitingFirstBall: 'ቁጥር #1...',
    drawnOf75: 'የተጠሩ',
    recentCalls: 'የቅርብ',
    board75Title: 'ሁሉም 75 ቁጥሮች',
    customCartela: 'ልዩ',
    cartelaNum: 'ካርቴላ',
    swap: 'መልስ',
    ready: 'ቢንጎ ዝግጁ!',
    free: 'ነጻ',
    claimBingo: 'ቢንጎ በል',
    checkAndClaim: 'ቢንጎ!',
    winnerBanner: 'ቢንጎ! አሸናፊ!',
    nextGameStarting: 'ቀጣዩ ጨዋታ በ',
    roundNoWinner: 'ዙሩ ያለ አሸናፊ አብቅቷል። ወደ ምርጫ በመመለስ ላይ...',
    recentWinnersAll: 'የቅርብ ጊዜ አሸናፊዎች',
    roundsInRoom: 'ዙሮች ተጫውተዋል',
    noWinnersYet: 'በዚህ ክፍለ ጊዜ ገና አሸናፊ የለም።',
    leaderboard: 'ምርጥ አሸናፊዎች',
    leaderboardEmpty: 'በዝርዝሩ ውስጥ ለመግባት ማንኛውንም ዙር ያሸንፉ።',
    winSingular: 'ድል',
    winPlural: 'ድሎች',
    settingsTitle: 'የጨዋታ ቅንብሮች',
    languageLabel: 'ቋንቋ እና የድምፅ ጥሪ',
    themeLabel: 'ገጽታ',
    darkMode: 'ጨለማ',
    lightMode: 'ብርሃን',
    soundEffects: 'የጨዋታ ድምፆች',
    voiceCaller: 'የድምፅ ቁጥር ጥሪ',
    autoMark: 'ቁጥሮችን በራሱ ምልክት አድርግ',
    autoMarkDesc: 'የተጠሩ ቁጥሮችን በካርቴላዎ ላይ በራሱ ያከባል',
    autoWin: 'በራሱ ቢንጎ አሸንፍ',
    autoWinDesc: 'መስመር ወይም 4 ማዕዘን ሲሞላ በራሱ ያሸንፋል',
    playerName: 'የተጫዋች ስም',
    save: 'አስቀምጥ',
    on: 'በርቷል',
    off: 'ጠፍቷል',
    done: 'ተከናውኗል',
    playingAs: 'የሚጫወቱት በ',
    notCalledYet: 'ገና አልተጠራም።',
    pausedByAdmin: 'ጨዋታው በአስተዳዳሪ ቆሟል',
    tapForCard: 'ካርቴላ',
    previewMode: 'አስቀድመው ይመልከቱ',
    previewCard: 'የካርቴላ ቅድመ-ዕይታ',
    lockThisCard: 'ይህን ካርቴላ ምረጥ',
    missions: 'ተልዕኮዎች',
    dailyQuests: 'የዕለት ተልዕኮዎች እና ደረጃ',
    claim: 'ውሰድ',
    claimedStatus: 'ተወስዷል',
    allBonusTitle: 'ሁሉንም ተልዕኮ ጨርስ',
    allBonusDesc: 'ሁሉንም ሲጨርሱ ተጨማሪ ሽልማት ያግኙ',
    noMissionsToday: 'ለጊዜው የተዘጋጀ ተልዕኮ የለም።',
    vipRank: 'የእርስዎ VIP ደረጃ',
    nextTierAt: 'ቀጣይ ደረጃ',
    maxRankReached: 'ከፍተኛው ፕላቲነም ደረጃ!',
    howToPlay: 'እንዴት ይጫወታሉ?',
    hideRules: 'መመሪያ ደብቅ',
    howToPlaySteps: [
      { title: '1. መደብ ወይም ልዩ ውድድር ይምረጡ', desc: 'መጫወት የሚፈልጉትን የብር መደብ (ወይም ልዩ ውድድር) ይንኩ።' },
      { title: '2. ካርቴላ ይምረጡ (30 ሰከንድ)', desc: 'ቆጣሪው 0 ከመድረሱ በፊት 1 ወይም ከዚያ በላይ ካርቴላ ይምረጡ። ከፈለጉ መልሰው ይቀይሩ።' },
      { title: '3. የተጠሩ ቁጥሮችን ይከታተሉ', desc: 'ቁጥሮች በአማርኛ/ኦሮምኛ/እንግሊዝኛ ድምፅ ይጠራሉ፤ ካርቴላዎም በራሱ ምልክት ይደረጋል።' },
      { title: '4. ቢንጎ ብለው ያሸንፉ!', desc: 'ቀድመው መስመር ወይም 4 ማዕዘን ሲሞሉ ሽልማቱ ወዲያውኑ ወደ ሂሳብዎ ይገባል።' },
    ],
    howToPlayPatternsTitle: 'የአሸናፊነት ቅርጾች',
    patternRow: 'አግድም መስመር (5)',
    patternCol: 'ቁመት መስመር (5)',
    patternDiag: 'ሰያፍ መስመር (5)',
    patternCorners: '4 ማዕዘኖች',
    specialEvents: 'ልዩ ውድድሮች',
    bonusPrize: 'ተጨማሪ ቦነስ',
    minPlayersNeeded: 'ዝቅተኛ ተጫዋች',
    endsIn: 'የሚያልቀው በ',
    findCartelaPlaceholder: 'ቁጥር ፈልግ #',
  },
  om: {
    brandName: 'Zemen Bingo',
    chooseStake: 'Hanga Filadhu',
    liveHall: 'Tapha Kallattii',
    winners: 'Mo’attoota',
    settings: 'Qindaa’ina',
    adminControls: 'Bulchaa',
    welcome: 'Baga nagaan dhuftan',
    online: 'sarara irra',
    reconnecting: 'Walqabsiisaa jira...',
    changeStake: 'Deebi’i',
    birr: 'Birrii',
    room: 'Kutaa',
    round: 'Marsaa',
    cartelas: 'kaarteelaawwan',
    players: 'Taphattoota',
    pool: 'Badhaasa',
    betPoolNet: 'Badhaasa Waliigalaa',
    deposited: 'Kuufame',
    won: 'Mo’ame',
    insufficientBalance: 'Herregni gahaan hin jiru',
    lobbyTitle: 'Hanga taphaa filadhu',
    enterRoom: 'Seeni',
    paused: 'Dhaabateera',
    nextIn: 'Itti aanu',
    selectionOpen: 'Filannoon Banaadha',
    pickBeforeZero: 'Kaarteelaa Kee Filadhu',
    sec: 'sek',
    timerExplain: 'Lakkoofsi 30 irraa gara 0 yoo ga’u waamichi ofumaan eegala.',
    selectCartelaPrefix: 'Kaarteelaa Filadhu',
    selectionLockedTitle: 'Filannoon Cufameera',
    selectionLockedHint: 'Marsaan kun yoo xumuramu filannoon sekondii 30 ofumaan banama.',
    pickAsManyAsBalance: 'Hanga herregni kee hayyametti kaarteelaa hedduu filadhu.',
    quickPick: 'Ariitii',
    customNumbers: 'Addaa',
    closeBuilder: 'Cufi',
    pickOwnNumbers: 'Kaarteelaa Mataa Keetii Tolchi',
    pickOwnHint: 'Tarree tokko keessatti lakkoofsa 5 filadhu (N keessatti 4 — gidduun BILISA).',
    shuffle: 'Walmaki',
    lockCustomCard: 'Kaarteelaa Dabali',
    available: 'Banaa',
    yours: 'Keessan',
    claimed: 'Qabame',
    you: 'Si',
    spectatingTitle: 'Tapha Hordofaa Jirta',
    spectatingHint: 'Akkuma Biingoon argameen gara filannootti deebita.',
    callingNow: 'Amma Waamamaa Jira',
    waitingFirstBall: 'Lakkoofsa #1...',
    drawnOf75: 'Waamaman',
    recentCalls: 'Dhihoo',
    board75Title: 'Lakkoofsota 75 Hunda',
    customCartela: 'Addaa',
    cartelaNum: 'Kaarteelaa',
    swap: 'Deebisi',
    ready: 'Biingoo Qophaa’eera!',
    free: 'BILISA',
    claimBingo: 'Biingoo Jedhi',
    checkAndClaim: 'Biingoo!',
    winnerBanner: 'BIINGOO! MO’ATAA!',
    nextGameStarting: 'Taphni itti aanu',
    roundNoWinner: 'Marsaan mo’ataa malee xumurameera. Gara filannootti deebi’aa jira...',
    recentWinnersAll: 'Mo’attoota Dhihoo',
    roundsInRoom: 'marsaan taphatame',
    noWinnersYet: 'Ammatti mo’ataan galmaa’e hin jiru.',
    leaderboard: 'Mo’attoota Dursan',
    leaderboardEmpty: 'Gabatee keessa seenuuf marsaa kamiyyuu mo’adhu.',
    winSingular: 'mo’annaa',
    winPlural: 'mo’annaa',
    settingsTitle: 'Qindaa’ina Taphaa',
    languageLabel: 'Afaan fi Sagalee Waamichaa',
    themeLabel: 'Bifa',
    darkMode: 'Dukkanaa’aa',
    lightMode: 'Ifaa',
    soundEffects: 'Sagaleewwan Taphaa',
    voiceCaller: 'Waamicha Lakkoofsaa Sagaleedhaan',
    autoMark: 'Ofumaan Mallatteessuu',
    autoMarkDesc: 'Lakkoofsota waamaman kaarteelaa kee irratti ofumaan mallatteessa',
    autoWin: 'Ofumaan Biingoo Mo’achuu',
    autoWinDesc: 'Sararri ykn goleewwan 4 yoo guutan ofumaan ni mo’ata',
    playerName: 'Maqaa Taphataa',
    save: 'Olkaa’i',
    on: 'Banaadha',
    off: 'Cufaam',
    done: 'Xumurame',
    playingAs: 'Maqaa',
    notCalledYet: 'ammatti hin waamamne.',
    pausedByAdmin: 'Taphni Bulchaadhaan Dhaabateera',
    tapForCard: 'Kaart',
    previewMode: 'Dursee Ilaali',
    previewCard: 'Dursee Ilaaluu Kaarteelaa',
    lockThisCard: 'Kaarteelaa Kana Filadhu',
    missions: 'Ergama',
    dailyQuests: 'Ergama Guyyaa fi Sadarkaa VIP',
    claim: 'Fudhadhu',
    claimedStatus: 'Fudhatameera',
    allBonusTitle: 'Ergama Hunda Xumuri',
    allBonusDesc: 'Hunda xumuruun badhaasa dabalataa argadhu',
    noMissionsToday: 'Ammatti ergamni banaa ta’e hin jiru.',
    vipRank: 'Sadarkaa VIP Kee',
    nextTierAt: 'Sadarkaan itti aanu',
    maxRankReached: 'Sadarkaa Platinum Olaanaa!',
    howToPlay: 'Akkaataa Taphaa',
    hideRules: 'Seera Dhoksi',
    howToPlaySteps: [
      { title: '1. Hanga ykn Dorgommii Addaa Filadhu', desc: 'Kutaa Birrii barbaadde (ykn Dorgommii Addaa) cuqaasi.' },
      { title: '2. Kaarteelaa Filadhu (30s)', desc: 'Lakkoofsi 0 osoo hin gahin kaarteelaa 1 ykn isaa ol filadhu.' },
      { title: '3. Lakkoofsota Waamaman Hordofi', desc: 'Sagalee Afaan Oromoo/Amaaraa/Ingiliffaan waamama; ofumaanis ni mallatteessa.' },
      { title: '4. Biingoo Jedhii Mo’adhu!', desc: 'Dursa sarara ykn golee 4 yoo guutte badhaasni yeroodhuma sana herrega keetti gala.' },
    ],
    howToPlayPatternsTitle: 'Haalawwan Mo’annaa',
    patternRow: 'Sarara Dalgaa (5)',
    patternCol: 'Sarara Dhaabbataa (5)',
    patternDiag: 'Sarara Qaxxaamuraa',
    patternCorners: 'Goleewwan 4',
    specialEvents: 'Dorgommiiwwan Addaa',
    bonusPrize: 'Badhaasa Dabalataa',
    minPlayersNeeded: 'Taphattoota xiqqaa',
    endsIn: 'Kan xumuramu',
    findCartelaPlaceholder: 'Lakkoofsa #',
  },
};
