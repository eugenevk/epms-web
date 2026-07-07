import '@fontsource/poppins/400.css'
import '@fontsource/poppins/500.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import { createApp, type Component } from 'vue'
import { createPinia } from 'pinia'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import App from './App.vue'
import router from './router'
import { vFocusFirst } from './directives/focusFirst'
import './lib/fontawesome'
import './assets/main.css'

const app = createApp(App)
app.component('FontAwesomeIcon', FontAwesomeIcon as Component)
app.directive('focus-first', vFocusFirst)
app.use(createPinia())
app.use(router)
app.mount('#app')
