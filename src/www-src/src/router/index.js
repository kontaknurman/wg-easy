import { createRouter, createWebHistory } from 'vue-router';
import LoginPage from '@/pages/LoginPage.vue';
import DashboardPage from '@/pages/DashboardPage.vue';
import DocsPage from '@/pages/DocsPage.vue';
import SettingsPage from '@/pages/SettingsPage.vue';

export const router = createRouter({
  history: createWebHistory('/'),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardPage, meta: { auth: true } },
    { path: '/login', name: 'login', component: LoginPage },
    { path: '/docs', name: 'docs', component: DocsPage },
    { path: '/settings', name: 'settings', component: SettingsPage, meta: { auth: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});
