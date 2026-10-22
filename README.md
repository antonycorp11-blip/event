# Event — inscrições e gestão de eventos

Aplicativo React/Vite com dados no Supabase. A equipe usa a raiz `/`; cada evento possui um link público `/e/<token>` para inscrições. O link público mostra apenas o evento correspondente e o formulário. Inscrições públicas entram com pagamento **Pendente**.

## Colocar inscrições no ar

1. No projeto Supabase `ojfnqcajbhvlqtprrfxg`, abra **SQL Editor** e execute todo o arquivo [supabase_schema.sql](./supabase_schema.sql). O resultado final mostra um `codigo_inicial`; guarde-o.
2. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no deploy. O `.env` local já está configurado. Nunca publique uma chave `service_role` no navegador.
3. Abra a raiz do aplicativo publicado. Preencha **Criar evento e liberar inscrições** com nome, valor e o `codigo_inicial`. Copie o link gerado e compartilhe com os inscritos. Nenhuma conta de administrador é necessária nesta etapa.
4. As listas de redes e discipuladores podem ser cadastradas depois. Enquanto vazias, o formulário permite digitar esses campos.
5. Quando for cadastrar a equipe, clique em **Cadastrar ou entrar como equipe → Criar primeiro acesso** e use o mesmo `codigo_inicial` com um e-mail e senha. Se o Supabase exigir confirmação por e-mail, confirme e depois entre com senha e código.

O SQL cria as tabelas, as funções do formulário público, um código inicial aleatório e as regras de acesso. Ele substitui as políticas antigas nas tabelas do aplicativo. O código inicial também permite criar eventos até o cadastro do primeiro administrador; depois é apagado.

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
