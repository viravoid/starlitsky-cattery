interface TabItem {
  icon: string;
  activeIcon: string;
  pagePath: string;
  text: string;
}

interface TapEvent {
  currentTarget: {
    dataset: {
      index?: number;
    };
  };
}

interface TabBarInstance {
  setData(data: { selected: number }): void;
}

const tabs: TabItem[] = [
  {
    pagePath: "/pages/home/index",
    text: "首页",
    icon: "/assets/tabbar/home.png",
    activeIcon: "/assets/tabbar/home-active.png",
  },
  {
    pagePath: "/pages/community/index",
    text: "猫友圈",
    icon: "/assets/tabbar/community.png",
    activeIcon: "/assets/tabbar/community-active.png",
  },
  {
    pagePath: "/pages/cats/index",
    text: "我们的猫",
    icon: "/assets/tabbar/cats.png",
    activeIcon: "/assets/tabbar/cats-active.png",
  },
];

Component({
  data: {
    selected: 0,
    tabs,
  },

  lifetimes: {
    attached(this: TabBarInstance) {
      syncSelected(this);
    },
  },

  pageLifetimes: {
    show(this: TabBarInstance) {
      syncSelected(this);
    },
  },

  methods: {
    switchTab(event: TapEvent) {
      const index = Number(event.currentTarget.dataset.index ?? 0);
      const item = tabs[index];
      if (!item) return;
      wx.switchTab({ url: item.pagePath });
    },
  },
});

function syncSelected(tabBar: TabBarInstance) {
  tabBar.setData({ selected: getSelectedIndex() });
  Promise.resolve().then(() => {
    tabBar.setData({ selected: getSelectedIndex() });
  });
}

function getSelectedIndex() {
  const pages = getCurrentPages();
  const current = pages[pages.length - 1]?.route;
  const index = tabs.findIndex((item) => item.pagePath.slice(1) === current);
  return index >= 0 ? index : 0;
}
