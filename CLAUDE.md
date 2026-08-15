# Bookdex

## Fluxo obrigatório após qualquer mudança no app

Sempre que uma mudança for implementada no código do app (nova funcionalidade, correção de bug,
refatoração, etc.), ao concluir a tarefa você deve, automaticamente, sem perguntar:

1. **Commit** das mudanças com mensagem descritiva no padrão dos commits anteriores (em
   português, resumindo o conjunto de funcionalidades/mudanças).
2. **Push** para o branch atual no remoto (`origin`).
3. **Gerar o APK atualizado**:
   ```bash
   npm run build && npx cap sync
   cd android && JAVA_HOME=/opt/homebrew/opt/openjdk@21 ./gradlew assembleDebug
   ```
   O arquivo sai em `android/app/build/outputs/apk/debug/app-debug.apk`.

Não é necessário pedir confirmação para esses três passos quando a mudança já foi solicitada e
implementada pelo usuário nesta sessão — eles fazem parte de concluir a tarefa, não de uma ação
nova e independente.
