export function aboutPage() {
  const page = document.createElement("main");
  page.className = "content";
  page.innerHTML = `<div class="page-heading"><div><p class="eyebrow">Produto</p><h2>Sobre o Portal</h2></div></div>
    <section class="panel"><h3>Portal de Inteligência de Fretes</h3>
      <p>Aplicação de análise de cotações e rotas com dados compartilhados no Cloud Firestore.</p>
      <dl class="about-list"><dt>Versão</dt><dd>0.2.0</dd><dt>Armazenamento</dt><dd>Cloud Firestore</dd><dt>Autenticação</dt><dd>Firebase Authentication anônima, com nome local apenas para auditoria</dd><dt>Importação e exportação</dt><dd>Processadas no navegador com SheetJS</dd></dl>
      <p>Não insira dados pessoais sensíveis. A autenticação anônima identifica uma sessão, não comprova a identidade do usuário. Configure e publique regras Firestore restritivas antes de usar dados corporativos.</p>
    </section>`;
  return page;
}
