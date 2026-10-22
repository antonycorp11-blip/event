# Event — inscrições e gestão de eventos

Aplicativo React/Vite com dados no Supabase. A equipe usa a raiz `/`; cada evento possui um link público `/e/<token>` para inscrições. O link público mostra apenas o evento correspondente e o formulário. Inscrições públicas entram com pagamento **Pendente**.

## Colocar inscrições no ar

1. Abra o app e toque em **Criar acesso** com seu e-mail e senha. Não há confirmação por e-mail nem código: o primeiro e-mail cadastrado vira o administrador, e depois disso ninguém mais consegue se tornar administrador.
2. No painel, cadastre redes, discipuladores e líderes na aba de listas. Eles aparecem automaticamente no formulário de inscrição de todos os eventos.
3. Na aba de eventos, crie o evento e use **Lotes e foto** para definir lotes de ingressos (o próximo lote começa quando o anterior esgota) e a foto horizontal. Copie o link exclusivo e compartilhe; quem se inscreve não precisa de login.

As alterações de banco já foram aplicadas no projeto Supabase `ojfnqcajbhvlqtprrfxg`. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no deploy e nunca publique uma chave `service_role` no navegador.

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
