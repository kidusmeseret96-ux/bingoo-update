import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Globe, Layers, MessageSquareText, Plus, Save, Trash2 } from 'lucide-react';
import type { BotTemplateButtonConfig, BotTextTemplateRecord } from '../types';

interface Props {
  templates: BotTextTemplateRecord[];
  busy: boolean;
  onUpsertTemplate: (payload: {
    template_key: string;
    language: 'en' | 'am' | 'om';
    title: string;
    message_text: string;
    buttons_config: BotTemplateButtonConfig[];
    is_custom: boolean;
  }) => Promise<void>;
  onDeleteTemplate: (templateKey: string) => Promise<void>;
}

interface BuiltinNodeMeta {
  key: string;
  label: string;
  desc: string;
  placeholders?: string;
}

const BUILTIN_NODES: BuiltinNodeMeta[] = [
  {
    key: 'contact_prompt',
    label: '1. Start Contact Share Prompt',
    desc: 'Sent immediately when a new user types /start before they share their phone contact.',
    placeholders: '{name}  (Button #1 label sets the Share Contact keyboard button text)',
  },
  {
    key: 'welcome_menu',
    label: '2. Main Welcome Menu',
    desc: 'Primary greeting & wallet menu sent after /start or Back to Home.',
    placeholders: '{name}, {dep}, {won}',
  },
  {
    key: 'deposit_intro',
    label: '3. Deposit Bank Selection Prompt',
    desc: 'Shown when player clicks Deposit to pick a payment bank.',
  },
  {
    key: 'voucher_prompt',
    label: '4. Deposit Voucher / Coupon Ask',
    desc: 'Shown when Vouchers are enabled and player picks a deposit bank.',
    placeholders: '{bank}',
  },
  {
    key: 'deposit_received',
    label: '5. Deposit Proof Received Confirmation',
    desc: 'Auto-reply after player submits a deposit screenshot or SMS.',
  },
  {
    key: 'deposit_accepted',
    label: '6. Deposit Approved Notification',
    desc: 'Sent to the player when an admin approves their deposit.',
    placeholders: '{amount}, {bank}, {bonus}, {code}',
  },
  {
    key: 'deposit_rejected',
    label: '7. Deposit Rejected Notification',
    desc: 'Sent to the player if a deposit proof is rejected.',
  },
  {
    key: 'withdraw_intro',
    label: '8. Withdraw Bank Selection Prompt',
    desc: 'Shown when player clicks Withdraw.',
  },
  {
    key: 'withdraw_prompt',
    label: '9. Withdraw Details Instruction',
    desc: 'Asked after picking a withdrawal bank without a custom bank reply.',
  },
  {
    key: 'withdraw_received',
    label: '10. Withdraw Request Received Confirmation',
    desc: 'Auto-reply when player submits withdrawal account & amount.',
  },
  {
    key: 'withdraw_done',
    label: '11. Withdraw Paid Notification',
    desc: 'Sent when admin marks a withdrawal Done.',
    placeholders: '{amount}',
  },
  {
    key: 'withdraw_incorrect',
    label: '12. Withdraw Incorrect Details Reply',
    desc: 'Sent when admin marks withdrawal details incorrect.',
  },
  {
    key: 'referral_intro',
    label: '13. Invite & Earn Referral Menu',
    desc: 'Referral program explanation, bonus tiers, and personal invite link.',
    placeholders: '{link}, {signup_bonus}, {deposit50_bonus}, {deposit100_bonus}, {invited}, {earned}',
  },
  {
    key: 'banned_notice',
    label: '14. Banned User Notice',
    desc: 'Reply sent to banned users who message the bot.',
  },
];

const LANGUAGES: Array<{ code: 'en' | 'am' | 'om'; label: string }> = [
  { code: 'en', label: 'English (EN)' },
  { code: 'am', label: 'Amharic (አማርኛ)' },
  { code: 'om', label: 'Afaan Oromo (OM)' },
];

export const BotFlowEditor: React.FC<Props> = ({
  templates,
  busy,
  onUpsertTemplate,
  onDeleteTemplate,
}) => {
  const [selectedLang, setSelectedLang] = useState<'en' | 'am' | 'om'>('en');
  const [selectedKey, setSelectedKey] = useState<string>('welcome_menu');

  const [newNodeSlug, setNewNodeSlug] = useState('');
  const [newNodeTitle, setNewNodeTitle] = useState('');

  // Active editor state synchronized when selection changes
  const customKeys = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of templates) {
      if (t.is_custom && !map.has(t.template_key)) {
        map.set(t.template_key, t.title || t.template_key);
      }
    }
    return Array.from(map.entries()).map(([key, title]) => ({ key, title }));
  }, [templates]);

  const isSelectedCustom = useMemo(
    () => !BUILTIN_NODES.some((n) => n.key === selectedKey),
    [selectedKey]
  );

  const currentRecord = useMemo(() => {
    return templates.find((t) => t.template_key === selectedKey && t.language === selectedLang) || null;
  }, [templates, selectedKey, selectedLang]);

  const [titleInput, setTitleInput] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [buttonsInput, setButtonsInput] = useState<BotTemplateButtonConfig[]>([]);

  const loadSelection = (key: string, lang: 'en' | 'am' | 'om') => {
    setSelectedKey(key);
    setSelectedLang(lang);
    const rec = templates.find((t) => t.template_key === key && t.language === lang);
    const builtin = BUILTIN_NODES.find((b) => b.key === key);
    setTitleInput(rec?.title || builtin?.label || key);
    setMessageInput(rec?.message_text || '');
    setButtonsInput(Array.isArray(rec?.buttons_config) ? rec!.buttons_config : []);
  };

  // Sync editor when templates load on initial mount
  React.useEffect(() => {
    const rec = templates.find((t) => t.template_key === selectedKey && t.language === selectedLang);
    const builtin = BUILTIN_NODES.find((b) => b.key === selectedKey);
    setTitleInput(rec?.title || builtin?.label || selectedKey);
    setMessageInput(rec?.message_text || '');
    setButtonsInput(Array.isArray(rec?.buttons_config) ? rec!.buttons_config : []);
  }, [templates, selectedKey, selectedLang]);

  const addButtonRow = () => {
    setButtonsInput((prev) => [
      ...prev,
      { label: 'New Button', action_type: 'template', action_value: 'welcome_menu' },
    ]);
  };

  const updateButtonRow = (idx: number, patch: Partial<BotTemplateButtonConfig>) => {
    setButtonsInput((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };

  const moveButtonRow = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= buttonsInput.length) return;
    setButtonsInput((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  };

  const removeButtonRow = (idx: number) => {
    setButtonsInput((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveCurrent = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedButtons = buttonsInput
      .filter((b) => b.label.trim().length > 0)
      .map((b) => ({
        label: b.label.trim(),
        action_type: b.action_type,
        action_value: b.action_value.trim(),
      }));

    await onUpsertTemplate({
      template_key: selectedKey,
      language: selectedLang,
      title: titleInput.trim() || selectedKey,
      message_text: messageInput,
      buttons_config: sanitizedButtons,
      is_custom: isSelectedCustom,
    });
  };

  const handleCreateCustomNode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedKey = newNodeSlug
      .trim()
      .toLowerCase()
      .replace(/^\/+/, '')
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!cleanedKey) return;

    await onUpsertTemplate({
      template_key: cleanedKey,
      language: selectedLang,
      title: newNodeTitle.trim() || `/${cleanedKey}`,
      message_text: `Custom reply for /${cleanedKey}. Edit this message anytime in the Bot Flow Builder.`,
      buttons_config: [{ label: '⬅️ Back to Menu', action_type: 'callback', action_value: 'menu:home' }],
      is_custom: true,
    });
    setNewNodeSlug('');
    setNewNodeTitle('');
    loadSelection(cleanedKey, selectedLang);
  };

  const activeBuiltinMeta = BUILTIN_NODES.find((b) => b.key === selectedKey);
  const allTargetKeys = [
    ...BUILTIN_NODES.map((b) => b.key),
    ...customKeys.map((c) => c.key),
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      {/* Left Sidebar: All Built-in Bot Texts & Custom Nodes */}
      <aside className="xl:col-span-4 space-y-4">
        <div className="bg-white/95 dark:bg-[#0D162E]/90 backdrop-blur-md border border-blue-200/80 dark:border-blue-500/25 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Built-In Bot Texts</h3>
          </div>
          <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
            {BUILTIN_NODES.map((node) => {
              const hasOverride = templates.some(
                (t) => t.template_key === node.key && t.language === selectedLang && t.message_text.trim().length > 0
              );
              const active = selectedKey === node.key;
              return (
                <button
                  key={node.key}
                  type="button"
                  onClick={() => loadSelection(node.key, selectedLang)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-between gap-2 cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold shadow-sm shadow-blue-500/25'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-500/10'
                  }`}
                >
                  <span className="truncate">{node.label}</span>
                  {hasOverride && (
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] shrink-0 font-semibold ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                      }`}
                    >
                      Custom
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Texts & /commands */}
        <div className="bg-white/95 dark:bg-[#0D162E]/90 backdrop-blur-md border border-blue-200/80 dark:border-blue-500/25 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Custom Texts &amp; Commands</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{customKeys.length}</span>
          </div>

          {customKeys.length > 0 && (
            <div className="space-y-1">
              {customKeys.map((c) => {
                const active = selectedKey === c.key;
                return (
                  <div key={c.key} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => loadSelection(c.key, selectedLang)}
                      className={`flex-1 text-left px-3 py-2 rounded-xl text-xs font-mono truncate cursor-pointer transition-all ${
                        active
                          ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold shadow-sm shadow-blue-500/25'
                          : 'text-slate-700 dark:text-slate-300 bg-blue-50/50 dark:bg-[#081022] hover:bg-blue-100/70 dark:hover:bg-blue-500/15'
                      }`}
                    >
                      /{c.key} — {c.title}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDeleteTemplate(c.key)}
                      title="Delete custom node"
                      className="p-2 text-red-600 dark:text-rose-400 hover:bg-red-50 dark:hover:bg-rose-500/15 rounded-xl cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <form onSubmit={handleCreateCustomNode} className="pt-3 border-t border-blue-100 dark:border-blue-500/20 space-y-2">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Create New Bot Text / Command</p>
            <input
              type="text"
              value={newNodeSlug}
              onChange={(e) => setNewNodeSlug(e.target.value)}
              placeholder="Command slug (e.g. rules or promo)"
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              value={newNodeTitle}
              onChange={(e) => setNewNodeTitle(e.target.value)}
              placeholder="Display title (e.g. House Rules)"
              className="w-full px-2.5 py-1.5 text-xs bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={busy || !newNodeSlug.trim()}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:brightness-110 disabled:opacity-50 rounded-xl shadow-sm shadow-blue-500/20 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Custom Text Node
            </button>
          </form>
        </div>
      </aside>

      {/* Main Flow & Button Editor */}
      <section className="xl:col-span-8 bg-white/95 dark:bg-[#0D162E]/90 backdrop-blur-md border border-blue-200/80 dark:border-blue-500/25 rounded-2xl p-6 shadow-sm">
        <form onSubmit={handleSaveCurrent} className="space-y-5">
          {/* Header + Language Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-blue-100 dark:border-blue-500/20">
            <div>
              <div className="flex items-center gap-2">
                <MessageSquareText className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  {activeBuiltinMeta ? activeBuiltinMeta.label : `Custom Node: /${selectedKey}`}
                </h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                {activeBuiltinMeta
                  ? activeBuiltinMeta.desc
                  : `Players can trigger this via /${selectedKey} or any button pointing to template "${selectedKey}".`}
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-[#081022] border border-blue-200/70 dark:border-blue-500/25 p-1 rounded-xl">
              <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 ml-1.5" />
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => loadSelection(selectedKey, l.code)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                    selectedLang === l.code
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-sm shadow-blue-500/20'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Node Key</label>
              <input
                type="text"
                readOnly
                value={selectedKey}
                className="w-full px-3 py-2 text-xs font-mono bg-blue-50/70 dark:bg-[#081022] text-slate-600 dark:text-cyan-300 border border-blue-200/70 dark:border-blue-500/20 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Admin Label / Title</label>
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Bot Message Text ({selectedLang.toUpperCase()}) — Leave empty on built-in keys to use default localized wording
              </label>
              {currentRecord?.updated_at && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  Saved: {new Date(currentRecord.updated_at).toLocaleString()}
                </span>
              )}
            </div>
            <textarea
              rows={5}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={`Enter ${selectedLang.toUpperCase()} message text for "${selectedKey}"...`}
              className="w-full px-3.5 py-2.5 text-sm bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
            {activeBuiltinMeta?.placeholders && (
              <p className="text-xs text-blue-800 dark:text-cyan-200 bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 rounded-xl px-3 py-2 mt-2 font-mono">
                Supported placeholders: {activeBuiltinMeta.placeholders}
              </p>
            )}
          </div>

          {/* Interactive Buttons Flow Builder */}
          <div className="border-t border-blue-100 dark:border-blue-500/20 pt-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Attached Reply Buttons &amp; Flow Actions</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Add custom inline buttons to this message. Route players to another text node, built-in menu, Mini App, or external URL.
                </p>
              </div>
              <button
                type="button"
                onClick={addButtonRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-cyan-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 border border-blue-200 dark:border-blue-500/30 rounded-xl cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Button
              </button>
            </div>

            {buttonsInput.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-4 px-3 bg-blue-50/40 dark:bg-[#081022] border border-dashed border-blue-200 dark:border-blue-500/25 rounded-xl">
                No custom buttons attached to this node yet. Built-in menus keep their standard Deposit / Withdraw / Play / Referral buttons, and any buttons you add here will appear seamlessly alongside them.
              </p>
            ) : (
              <div className="space-y-2.5">
                {buttonsInput.map((btn, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 bg-blue-50/50 dark:bg-[#081022] border border-blue-200/70 dark:border-blue-500/20 rounded-xl items-center"
                  >
                    <div className="md:col-span-4">
                      <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-0.5">
                        Button Label
                      </label>
                      <input
                        type="text"
                        value={btn.label}
                        onChange={(e) => updateButtonRow(idx, { label: e.target.value })}
                        placeholder="e.g. Support Channel"
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#0D162E] border border-blue-200 dark:border-blue-500/25 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-0.5">
                        Action Type
                      </label>
                      <select
                        value={btn.action_type}
                        onChange={(e) =>
                          updateButtonRow(idx, {
                            action_type: e.target.value as BotTemplateButtonConfig['action_type'],
                          })
                        }
                        className="w-full px-2 py-1.5 text-xs bg-white dark:bg-[#0D162E] border border-blue-200 dark:border-blue-500/25 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="template">Open Text Node</option>
                        <option value="callback">Bot Menu Action</option>
                        <option value="url">External Link (URL)</option>
                        <option value="web_app">Open Mini App</option>
                      </select>
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-0.5">
                        Target Value
                      </label>
                      {btn.action_type === 'template' ? (
                        <select
                          value={btn.action_value}
                          onChange={(e) => updateButtonRow(idx, { action_value: e.target.value })}
                          className="w-full px-2 py-1.5 text-xs font-mono bg-white dark:bg-[#0D162E] border border-blue-200 dark:border-blue-500/25 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                        >
                          {allTargetKeys.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </select>
                      ) : btn.action_type === 'callback' ? (
                        <select
                          value={btn.action_value}
                          onChange={(e) => updateButtonRow(idx, { action_value: e.target.value })}
                          className="w-full px-2 py-1.5 text-xs font-mono bg-white dark:bg-[#0D162E] border border-blue-200 dark:border-blue-500/25 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="menu:home">menu:home (Home)</option>
                          <option value="menu:deposit">menu:deposit (Deposit)</option>
                          <option value="menu:withdraw">menu:withdraw (Withdraw)</option>
                          <option value="menu:referral">menu:referral (Invite)</option>
                          <option value="menu:language">menu:language (Language)</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={btn.action_value}
                          onChange={(e) => updateButtonRow(idx, { action_value: e.target.value })}
                          placeholder={btn.action_type === 'url' ? 'https://t.me/...' : 'Optional custom URL'}
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-[#0D162E] border border-blue-200 dark:border-blue-500/25 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                        />
                      )}
                    </div>

                    <div className="md:col-span-2 flex items-center justify-end gap-1 pt-3 md:pt-0">
                      <button
                        type="button"
                        onClick={() => moveButtonRow(idx, -1)}
                        className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-lg cursor-pointer"
                        title="Move up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveButtonRow(idx, 1)}
                        className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-lg cursor-pointer"
                        title="Move down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeButtonRow(idx)}
                        className="p-1.5 text-red-600 dark:text-rose-400 hover:bg-red-50 dark:hover:bg-rose-500/15 rounded-lg cursor-pointer"
                        title="Delete button"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-blue-100 dark:border-blue-500/20">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:brightness-110 disabled:opacity-50 rounded-xl shadow-md shadow-blue-500/20 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Save className="w-4 h-4" />
              Save {selectedLang.toUpperCase()} Text &amp; Buttons
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
