/**
 * Script de parche para expo-notifications en Expo Go (SDK 53 / Android).
 *
 * En SDK 53, expo-notifications incluyó una verificación en warnOfExpoGoPushUsage.js
 * que lanza una excepción fatal ('throw new Error') en Android al importar el módulo en Expo Go.
 * Este script convierte ese throw en un console.warn inofensivo, permitiendo que
 * la app use notificaciones locales y WebSocket sin congelar el runtime de Expo Go.
 */
const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.join(__dirname, '..', 'node_modules', 'expo-notifications', 'build', 'warnOfExpoGoPushUsage.js'),
  path.join(__dirname, '..', 'node_modules', 'expo-notifications', 'src', 'warnOfExpoGoPushUsage.ts'),
];

targetFiles.forEach((filePath) => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('throw new Error(message);')) {
      content = content.replace(
        'throw new Error(message);',
        'if (__DEV__ && !didWarn) { didWarn = true; console.warn(message); }'
      );
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`[Patch] Parche aplicado exitosamente a: ${path.basename(filePath)}`);
    } else {
      console.log(`[Patch] El archivo ya está parcheado: ${path.basename(filePath)}`);
    }
  }
});
