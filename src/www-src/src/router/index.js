import { createRouter, createWebHistory } from 'vue-router';
import LoginPage from '@/pages/LoginPage.vue';
import DashboardPage from '@/pages/DashboardPage.vue';

// Login and dashboard are what every visit starts with; the other pages are
// split into their own chunks and only downloaded when opened.
export const router = createRouter({
  history: createWebHistory('/'),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardPage, meta: { auth: true } },
    { path: '/login', name: 'login', component: LoginPage },
    { path: '/docs', name: 'docs', component: () => import('@/pages/DocsPage.vue') },
    { path: '/settings', name: 'settings', component: () => import('@/pages/SettingsPage.vue'), meta: { auth: true } },
    { path: '/clients/:id', name: 'client-detail', component: () => import('@/pages/ClientDetailPage.vue'), meta: { auth: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});
