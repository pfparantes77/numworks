# Ambiente NumWorks — Pedro Arantes

Aplicação Web estática para utilização da calculadora gráfica NumWorks em contexto de aula/teste.

## O que faz

- Incorpora o simulador oficial NumWorks diretamente na página.
- Solicita Nome, N.º e Turma.
- Tenta iniciar o modo de ecrã inteiro.
- Regista **localmente**, no navegador:
  - mudança para outro separador/página;
  - minimização ou perda de foco da janela;
  - saída do modo de ecrã inteiro;
  - fecho/recarregamento e posterior recuperação da sessão;
  - hora e duração das ausências.
- Gera um relatório local protegido por PIN.
- Não utiliza Firebase, Supabase ou qualquer base de dados.
- Não envia os dados do aluno para qualquer servidor desta aplicação.
- Não identifica os sites ou aplicações utilizados durante uma ausência.

## PIN do professor

O PIN inicial é:

`2718`

Antes de publicar, pode alterá-lo na primeira linha de configuração de `app.js`:

```js
const TEACHER_PIN = "2718";
```

> Nota: numa aplicação Web estática, o PIN não é criptograficamente secreto — um utilizador tecnicamente avançado pode consultar o código-fonte. Serve como barreira funcional contra alterações acidentais ou utilização comum, não como mecanismo de segurança forte.

## Publicar em GitHub Pages

Para obter:

`https://pedroarantes.github.io/numworks/`

1. Entre no GitHub com a conta `pedroarantes`.
2. Crie um repositório **público** chamado `numworks`.
3. Envie para a raiz do repositório:
   - `index.html`
   - `style.css`
   - `app.js`
4. Abra **Settings → Pages**.
5. Em **Build and deployment**, escolha **Deploy from a branch**.
6. Selecione `main` e `/ (root)`.
7. Grave.

## Como usar

1. O aluno abre o endereço da aplicação.
2. Introduz Nome, N.º e Turma e seleciona “Tomei conhecimento”.
3. Clica em **Iniciar sessão**.
4. Trabalha com a NumWorks incorporada.
5. No final, o professor vai ao computador do aluno e clica em **Relatório da sessão**.
6. Introduz o PIN.
7. Verifica:
   - número de saídas;
   - duração total fora;
   - horários;
   - recarregamentos.
8. Clica em **Terminar sessão**.
9. Depois da verificação, pode usar **Limpar e preparar nova sessão**.

## Limitações importantes

Uma página Web não consegue controlar totalmente um computador pessoal. Em particular:

- não consegue saber que site ou aplicação o aluno abriu;
- não consegue impedir de forma absoluta `Alt+Tab`, abertura de novas aplicações ou utilização de outro dispositivo;
- um aluno com conhecimentos técnicos pode apagar/manipular `localStorage` ou inspecionar o código;
- o sistema deve ser entendido como **registo local de abandono do ambiente**, não como navegador seguro de exame.

## Privacidade

Os dados ficam no `localStorage` do navegador do próprio dispositivo. Não há base de dados da aplicação.

Como boa prática, use apenas os dados estritamente necessários e elimine a sessão após a verificação. Em Portugal, são relevantes o Regulamento (UE) 2016/679 (RGPD), nomeadamente o princípio da minimização dos dados, e a Lei n.º 58/2019, de 8 de agosto.

## Fonte do simulador

A NumWorks disponibiliza oficialmente integração por `iframe`:

`https://www.numworks.com/simulator/embed/`
