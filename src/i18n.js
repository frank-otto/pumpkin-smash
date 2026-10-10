// EN (default) / DE strings, rank titles and share texts
const STR = {
  en: {
    score: 'Score', bossName: 'GIANT PUMPKIN', kicker: 'A 60-second Halloween frenzy', tag: 'Swipe through the fog. Smash the pumpkins. Beat the giant.',
    play: 'PLAY', how: '🎃 Swipe or click pumpkins &nbsp;·&nbsp; 👻 Ghosts = bonus &nbsp;·&nbsp; 💣 Avoid skull bombs',
    howKids: '🎃 Swipe or tap pumpkins &nbsp;·&nbsp; 👻 Ghosts = bonus &nbsp;·&nbsp; 🐈‍⬛ Let the sleepy cat sleep',
    kids: 'Kids mode', settings: '⚙ Settings', best: 'Best', settingsT: 'Settings', quality: 'Quality', q_low: 'Low', q_mid: 'Medium', q_high: 'High',
    music: 'Music', sfx: 'Sound effects', mute: 'Mute all', close: 'Done', paused: 'Paused', resume: 'RESUME', quit: 'Quit round',
    endTitle: 'ROUND OVER', newBest: 'NEW BEST!', stSmash: 'pumpkins', stCombo: 'best combo', stBoss: 'boss', name: 'Name',
    shareT: 'Share text', share: 'Copy share text', shot: 'Save screenshot', replay: 'PLAY AGAIN',
    go: 'SMASH!', goSub: '60 SECONDS', boss: 'GIANT PUMPKIN!', bossSub: 'SMASH IT TO PIECES', bossDead: 'BOSS SMASHED!', timeUp: 'TIME!',
    combo: 'COMBO', copied: 'Copied! Paste it on X 🎃', copyFail: 'Copy failed – select the text manually', saved: 'Screenshot saved 📸',
    suggested: 'Suggested for this device', fpsLow: 'Running slow – switched quality to', bonusTime: '+5 SEC', bonusMult: 'DOUBLE POINTS', ouch: 'OUCH!', shh: 'SHHH… 😺',
    defeated: 'smashed', alive: 'escaped', autoQ: 'Quality auto-set to'
  },
  de: {
    score: 'Punkte', bossName: 'RIESENKÜRBIS', kicker: '60 Sekunden Halloween-Wahnsinn', tag: 'Wisch durch den Nebel. Zerschlag die Kürbisse. Besiege den Riesen.',
    play: 'SPIELEN', how: '🎃 Kürbisse wischen oder klicken &nbsp;·&nbsp; 👻 Geister = Bonus &nbsp;·&nbsp; 💣 Totenkopf-Bomben meiden',
    howKids: '🎃 Kürbisse wischen oder tippen &nbsp;·&nbsp; 👻 Geister = Bonus &nbsp;·&nbsp; 🐈‍⬛ Die schlafende Katze schlafen lassen',
    kids: 'Kinder-Modus', settings: '⚙ Einstellungen', best: 'Rekord', settingsT: 'Einstellungen', quality: 'Qualität', q_low: 'Niedrig', q_mid: 'Mittel', q_high: 'Hoch',
    music: 'Musik', sfx: 'Effekte', mute: 'Alles stumm', close: 'Fertig', paused: 'Pause', resume: 'WEITER', quit: 'Runde beenden',
    endTitle: 'RUNDE VORBEI', newBest: 'NEUER REKORD!', stSmash: 'Kürbisse', stCombo: 'beste Kombo', stBoss: 'Boss', name: 'Name',
    shareT: 'Text zum Teilen', share: 'Text kopieren', shot: 'Screenshot speichern', replay: 'NOCHMAL',
    go: 'LOS!', goSub: '60 SEKUNDEN', boss: 'RIESENKÜRBIS!', bossSub: 'HAU IHN IN STÜCKE', bossDead: 'BOSS BESIEGT!', timeUp: 'ZEIT!',
    combo: 'KOMBO', copied: 'Kopiert! Ab damit auf X 🎃', copyFail: 'Kopieren fehlgeschlagen – Text bitte markieren', saved: 'Screenshot gespeichert 📸',
    suggested: 'Empfohlen für dieses Gerät', fpsLow: 'Läuft langsam – Qualität jetzt', bonusTime: '+5 SEK', bonusMult: 'DOPPELTE PUNKTE', ouch: 'AUTSCH!', shh: 'PSST… 😺',
    defeated: 'besiegt', alive: 'entkommen', autoQ: 'Qualität automatisch:'
  }
};
export const RANKS = [
  { min: 0, en: 'Pumpkin Apprentice', de: 'Kürbis-Lehrling' },
  { min: 1200, en: 'Pumpkin Carver', de: 'Kürbis-Schnitzer' },
  { min: 2600, en: 'Ghost Hunter', de: 'Geisterjäger' },
  { min: 4200, en: 'Pumpkin Ninja', de: 'Kürbis-Ninja' },
  { min: 6200, en: 'Midnight Master', de: 'Mitternachts-Meister' },
  { min: 8500, en: 'Pumpkin King', de: 'Kürbiskönig' }
];
let lang = 'en';
try { lang = localStorage.getItem('ps-lang') || 'en'; } catch (e) {}
export function getLang() { return lang; }
export function setLang(l) { lang = l === 'de' ? 'de' : 'en'; try { localStorage.setItem('ps-lang', lang); } catch (e) {} document.documentElement.lang = lang; }
export function T(k, l = lang) { return (STR[l] && STR[l][k]) || STR.en[k] || k; }
export function rankFor(score, l = lang) { let r = RANKS[0]; for (const x of RANKS) if (score >= x.min) r = x; return r[l]; }
export function applyI18n(kids) {
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = T(el.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-html]').forEach(el => { const k = el.getAttribute('data-i18n-html'); el.innerHTML = T(kids && k === 'how' ? 'howKids' : k); });
}
export function fmt(n, l = lang) { return Math.round(n).toLocaleString(l === 'de' ? 'de-DE' : 'en-US'); }
export function shareText(r, l) {
  const rank = rankFor(r.score, l), s = fmt(r.score, l);
  if (l === 'de') {
    return `🎃 ${r.name} hat in PUMPKIN SMASH ${s} Punkte geholt – Rang: ${rank}!\n` +
      `${r.smashed} Kürbisse zerschlagen, beste Kombo x${r.bestCombo}${r.bossKilled ? ', Riesenkürbis besiegt 💥' : ''}.\n` +
      `Schaffst du mehr? 👻 #PumpkinSmash #Halloween`;
  }
  return `🎃 ${r.name} scored ${s} in PUMPKIN SMASH — rank: ${rank}!\n` +
    `${r.smashed} pumpkins smashed, best combo x${r.bestCombo}${r.bossKilled ? ', giant boss destroyed 💥' : ''}.\n` +
    `Can you beat that? 👻 #PumpkinSmash #Halloween`;
}
