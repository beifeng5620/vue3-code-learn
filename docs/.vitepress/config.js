import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Vue3 响应式基础",
  themeConfig: {
    sidebar: [
      {
        text: "准备工作",
        collapsible: true,
        items: [
          {
            text: "介绍",
            items: [
              {
                text: "为什么要学习vue源码",
                link: "/prepare/"
              },
              {
                text: "基础知识准备",
                link: "/prepare/base.md"
              }
            ]
          }
        ]
      },
      {
        text: "响应式系统",
        collapsible: true,
        items: [
          {
            text: "响应系统的作用与实现",
            link: "/core/"
          },
          {
            text: "非原始值的响应式方案",
            link: "/core/noOrigin/"
          },
          {
            text: "原始值的响应式方案",
            link: "/core/origin/"
          }
        ]
      },
      {
        text: "虚拟DOM",
        collapsible: true,
        collapsed: true,
        items: [
          {
            text: "快速Diff算法",
            link: "/vnode/"
          }
        ]
      }
    ]
  },
  markdown: {
    lineNumbers: true
  }
});
