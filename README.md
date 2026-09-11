# Event - Sistema de Inscrições e Gestão

Aplicativo web mobile-first desenvolvido para gestão e inscrições de eventos, com sincronização em tempo real no **Supabase**, filtros combinados e extração instantânea para planilhas **Excel (.xlsx)** e **CSV**.

## 🚀 Funcionalidades

- **📱 Formulário Mobile-First**: Otimizado para smartphones, com cálculo automático de idade, confirmação com animação de confetes e comprovante.
  - **Nome Completo**
  - **Data de Nascimento** (com cálculo automático de idade)
  - **Sua Rede** (seleção das redes cadastradas)
  - **Seu Discipulador** (seleção dos discipuladores cadastrados)
  - **Líder** (campo livre que pode ficar em branco)
  - **Forma de Pagamento** (PIX, Cartão de Crédito, Cartão de Débito, Dinheiro)
  - **WhatsApp / Celular** (opcional)
- **⚙️ Gerenciador de Listas**: Aba para cadastrar e excluir Redes e Discipuladores dinamicamente.
- **📊 Painel de Inscritos & Métricas**: Visualização em tabela (desktop) e cartões (mobile) com status de pagamento.
- **🔍 Filtros Cruzados**: Filtre simultaneamente por Evento, Rede, Discipulador, Líder (incluindo participantes sem líder), Forma de Pagamento e Status.
- **📥 Extração com Filtros**:
  - Exportação para **Excel (.xlsx)** com formatação automática de colunas.
  - Exportação para **CSV** (UTF-8 com BOM para abrir sem erros de acentuação no Excel).
  - O arquivo baixado reflete com exatidão os filtros ativos na tela.
- **🗄️ Integração Supabase**: Conexão com banco de dados em nuvem e suporte a persistência local (fallback).

---

## 🛠️ Configuração do Banco de Dados (Supabase)

1. Acesse o painel do seu projeto no [Supabase](https://supabase.com).
2. Vá no menu **SQL Editor** e crie uma nova query.
3. Copie todo o conteúdo do arquivo [`supabase_schema.sql`](./supabase_schema.sql) e clique em **Run**.
4. Vá em **Project Settings > API**, copie a **Project URL** e a chave **anon public**.
5. No app, clique no botão **"Conectar BD"** no canto superior direito e cole as informações (ou crie um arquivo `.env` baseado no `.env.example`).

---

## 💻 Como Rodar Localmente

```bash
# 1. Instalar as dependências
npm install

# 2. Iniciar o servidor de desenvolvimento
npm run dev
```

O aplicativo estará disponível em:
- **Local**: `http://localhost:3000/`
- **Na mesma rede Wi-Fi (para celular)**: `http://<SEU_IP_LOCAL>:3000/`

---

## 📱 Testando no Celular

Para testar diretamente no smartphone durante o desenvolvimento local:
1. Conecte o celular na mesma rede Wi-Fi do computador.
2. Acesse pelo navegador do celular o endereço de rede exibido no terminal (exemplo: `http://192.168.x.x:3000`).

---

## 📦 Deploy Gratuito (Vercel ou Netlify)

Para ter um link público definitivo acessível de qualquer lugar:
1. Conecte o repositório GitHub na [Vercel](https://vercel.com) ou [Netlify](https://netlify.com).
2. Adicione as variáveis de ambiente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Clique em **Deploy**!
