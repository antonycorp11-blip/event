# Event — inscrições e gestão de eventos

Aplicativo React/Vite com dados no Supabase. A equipe usa a raiz `/`; cada evento possui um link público `/e/<token>` para inscrições. O link público mostra apenas o evento correspondente e o formulário. Inscrições públicas entram com pagamento **Pendente**.

## Colocar inscrições no ar

1. Abra o app e toque em **Criar acesso** com seu e-mail e senha. Não há confirmação por e-mail nem código: o primeiro e-mail cadastrado vira o administrador, e depois disso ninguém mais consegue se tornar administrador.
2. No painel, cadastre redes, discipuladores e líderes na aba de listas. Eles aparecem automaticamente no formulário de inscrição de todos os eventos.
3. Na aba de eventos, crie o evento e use **Lotes e foto** para definir lotes de ingressos (o próximo lote começa quando o anterior esgota) e a foto horizontal. Copie o link exclusivo e compartilhe; quem se inscreve não precisa de login.

As alterações de banco já foram aplicadas no projeto Supabase `ojfnqcajbhvlqtprrfxg`. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no deploy e nunca publique uma chave `service_role` no navegador.

## Pix automático (Woovi), ingresso e check-in

Quem se inscreve pelo link recebe um Pix com QR Code e "copia e cola" no valor do ingresso. Quando o pagamento cai, a Woovi avisa o app, a inscrição vira **Confirmado** e o ingresso com QR Code aparece na mesma tela. O aparelho lembra a inscrição: ao voltar ao link, a pessoa vê o Pix pendente ou o ingresso. Em outro celular, ela encontra a inscrição pelo nome e pela data de nascimento. Um Pix não pago expira (60 minutos por padrão) e a vaga volta para o lote. Evento gratuito já sai confirmado, com ingresso.

1. Execute `supabase_pix.sql` no SQL Editor do Supabase.
2. Na Vercel (Settings › Environment Variables), cadastre:
   - `WOOVI_APP_ID`: AppID da API criado no painel da Woovi.
   - `SUPABASE_SERVICE_ROLE_KEY`: chave secreta do Supabase (Project Settings › API). Fica só no servidor; nunca coloque no código nem em variável `VITE_`.
   - Opcional: `PIX_EXPIRES_MINUTES` (padrão 60) e `WOOVI_API_URL=https://api.woovi-sandbox.com` para testar no sandbox.
3. No painel da Woovi, cadastre o webhook `https://SEU-SITE/api/pix-webhook` para o evento de cobrança paga (`OPENPIX:CHARGE_COMPLETED`) e, se quiser, o de cobrança expirada (`OPENPIX:CHARGE_EXPIRED`).

Sem `WOOVI_APP_ID`, o link continua mostrando a chave Pix manual e o envio de comprovante pelo WhatsApp.

**Check-in:** o QR do ingresso abre `/c/<código>`. A equipe, logada no painel, aponta a câmera do celular e toca em **Confirmar entrada**. Uma segunda leitura do mesmo ingresso mostra "Já entrou". No painel também há o botão **Registrar entrada** em cada inscrito confirmado.

## Desenvolvimento e deploy

```bash
npm install
npm run dev
npm run build
```

O arquivo `vercel.json` e `public/_redirects` configuram a rota `/e/*` para Vercel e Netlify. Em outra hospedagem, faça essa rota retornar `index.html` mantendo a URL do navegador.

## Acesso dos links

- `/`: cadastro e login da equipe, atendimento e administração.
- `/e/<token>`: formulário do evento vinculado ao token. Não consulta inscritos, outros eventos ou ferramentas administrativas.
- Usuários anônimos não têm acesso direto às tabelas. As funções SQL públicas só devolvem o evento do token e aceitam novas inscrições pendentes nesse evento.
- Para encerrar um link, altere `active` do evento para `false` no Supabase. Para trocar o link, gere outro `share_token` no SQL Editor.

```sql
update public.events set active = false where id = 'ID_DO_EVENTO';
-- ou, para manter o evento ativo com outro link:
update public.events set share_token = gen_random_uuid() where id = 'ID_DO_EVENTO';
```
