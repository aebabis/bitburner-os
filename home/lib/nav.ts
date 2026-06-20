const doc = globalThis['document'];

const HackingTabs = ['Terminal'] as const;
const CharacterTabs = ['Factions', 'Augmentations'] as const;

type HackingTab = (typeof HackingTabs)[number];
type CharacterTab = (typeof CharacterTabs)[number];

type Tab = HackingTab | CharacterTab;

const Tabs = {
  Hacking: HackingTabs,
  Character: CharacterTabs,
} as const;

type TabGroup = keyof typeof Tabs;

const tabGroups = Object.fromEntries(
  Object.entries(Tabs).flatMap(([groupName, tabs]) => tabs.map((tab) => [tab, groupName])),
) as Record<Tab, TabGroup>;

const groupFor = (tab: Tab) => tabGroups[tab];

export const isFocused = () => doc.querySelector('.MuiDrawer-root') == null;
export const isExpanded = (group: TabGroup) =>
  getDrawerButton(group).nextElementSibling?.tagName === 'DIV';

const toggleTabGroup = (group: TabGroup, expanded?: boolean) => {
  if (isExpanded(group) !== expanded || typeof expanded === 'undefined') {
    clickDrawerTab(group);
  }
};

const clickButton = (text: string) => {
  const buttons = [...doc.querySelectorAll('button')] as HTMLButtonElement[];
  const target = buttons.find((button) => button.innerText.includes(text));
  target?.click();
};

const getDrawerButton = (text: string) =>
  (doc.querySelector(`[role="button"]:has([aria-label="${text}"])`) ||
    ([...doc.querySelectorAll('[role="button"]')] as HTMLDivElement[]).find((button) =>
      button.innerText.includes(text),
    )) as HTMLDivElement;

const clickDrawerTab = (tab: string) => {
  getDrawerButton(tab).click();
};

export const goToTab = (ns: NS) => async (tab: Tab) => {
  if (isFocused()) {
    clickButton('Do something else simultaneously');
    await ns.sleep(1);
  }
  if (!isExpanded(groupFor(tab))) {
    toggleTabGroup(groupFor(tab));
    await ns.sleep(1);
  }
  clickDrawerTab(tab);
  await ns.sleep(1);
};

export const sendTerminalCommand = (ns: NS) => async (command: string) => {
  await goToTab(ns)('Terminal');
  const input = doc.querySelector('input');

  if (!input) {
    throw new Error('input not found');
  }
  input.focus();

  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    globalThis.HTMLInputElement.prototype,
    'value',
  )!.set;
  nativeInputValueSetter!.call(input, command);
  const event = new Event('input', { bubbles: true });
  input.dispatchEvent(event);

  input.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true, // Crucial: React listens at the root/parent level
      cancelable: true,
    }),
  );
  await ns.sleep(1);
  clickButton('Focus');
  await ns.sleep(1);
};
