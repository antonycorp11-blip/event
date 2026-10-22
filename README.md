# Event — inscrições e gestão de eventos

Aplicativo React/Vite com dados no Supabase. A equipe usa a raiz `/`; cada evento possui um link público `/e/<token>` para inscrições. O link público mostra apenas o evento correspondente e o formulário. Inscrições públicas entram com pagamento **Pendente**.

## Colocar inscrições no ar

1. No projeto Supabase `ojfnqcajbhvlqtprrfxg`, abra **SQL Editor** e execute todo o arquivo [supabase_urgente.sql](supabase_urgente.sql). O resultado final mostra um `codigo_inicial`; guarde-o. Se ele já foi executado, não repita esta etapa.
2. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no deploy. O `.env` local já está configurado. Nunca publique uma chave `service_role` no navegador.
3. Abra a raiz do aplicativo publicado. Preencha **Eventos** com nome, valor ou lotes, o `codigo_inicial` e, se quiser, as listas de redes, discipuladores e líderes. Copie o link completo gerado e compartilhe com os inscritos. Nenhuma conta de administrador é necessária nesta etapa.
4. Para mudar um evento já criado, escolha **Editar evento existente** e cole seu link. O link atualizado inclui as opções de equipe no fragmento `#equipe=...`; substitua o link antigo ao divulgar. Essas opções não são gravadas no banco nesta etapa. Enquanto as listas estão vazias, o formulário permite digitar rede e discipulador.
5. O acesso administrativo por e-mail requer as funções e políticas adicionais de [supabase_schema.sql](supabase_schema.sql); essa etapa pode ser feita depois.

## Lotes de ingressos

Execute [supabase_lotes.sql](supabase_lotes.sql) uma vez no SQL Editor do mesmo projeto Supabase antes de criar lotes. Na tela **Eventos**, escolha **Lotes de ingressos** e informe nome, quantidade e valor de cada lote. O segundo lote começa automaticamente quando o primeiro esgota. A inscrição reserva a vaga no banco no momento do envio; inscrições simultâneas não ultrapassam a quantidade. Um evento já criado pode receber lotes ao colar seu link na tela **Eventos**. Nesse caso, a quantidade de cada novo lote vale para as próximas inscrições; as anteriores não são incluídas retroativamente. O formulário antigo de preço único continua funcionando sem essa migração.

## Foto horizontal do evento

Execute [supabase_foto.sql](supabase_foto.sql) uma vez no SQL Editor do mesmo projeto Supabase para ativar fotos. Em **Eventos**, selecione uma imagem JPG, PNG ou WebP. O navegador a ajusta para 16:9 antes de salvar; ela aparece acima do formulário no link público. É possível acrescentar ou trocar a foto de um evento existente em **Editar evento existente**. Eventos e lotes sem foto continuam funcionando.

O SQL inicial cria as tabelas, as funções do formulário público, um código inicial aleatório e as regras de acesso. O código inicial permite criar eventos sem conta administrativa.

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
