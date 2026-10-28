import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default [{ignores:['.next/**','node_modules/**']},{files:['src/**/*.{ts,tsx}'],languageOptions:{parser:tseslint.parser,parserOptions:{ecmaFeatures:{jsx:true},sourceType:'module'}},rules:{...js.configs.recommended.rules,'no-undef':'off','no-unused-vars':'off','no-constant-condition':'off','no-empty':'off'}}];
