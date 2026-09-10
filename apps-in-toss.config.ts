import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  // Apps in Toss 배포 식별자는 기존 호환성을 위해 유지한다.
  // 사용자에게 보이는 브랜드명은 Web/PWA metadata의 "갈라고"가 source of truth다.
  appName: 'galanda',
  brand: {
    primaryColor: '#3182F6',
  },
  permissions: [],
  webBundleDir: 'dist',
});
