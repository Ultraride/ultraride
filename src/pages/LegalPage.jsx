import { Children, isValidElement, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function slugify(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function textOf(children) {
  return Children.toArray(children)
    .map((c) => (typeof c === "string" || typeof c === "number" ? c : isValidElement(c) ? textOf(c.props.children) : ""))
    .join("");
}

const components = {
  // Les ancres (#article-4-comptes-utilisateurs…) permettent de pointer
  // directement vers un article.
  h2: ({ node, children, ...props }) => <h2 id={slugify(textOf(children))} {...props}>{children}</h2>,
  // Le tableau défile dans son propre conteneur : la page, jamais.
  table: ({ node, ...props }) => (
    <div className="legal-table-scroll"><table {...props} /></div>
  ),
  // Liens internes via le routeur, sans rechargement de page.
  a: ({ node, href = "", children, ...props }) =>
    href.startsWith("/")
      ? <Link to={href} {...props}>{children}</Link>
      : href.startsWith("mailto:")
        ? <a href={href} {...props}>{children}</a>
        : <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>,
};

export default function LegalPage({ content, title, className = "" }) {
  const { hash } = useLocation();

  // Ancre dans l'URL (/cgu#article-7-…) : on descend jusqu'au titre visé,
  // sinon on repart du haut de la page.
  useEffect(() => {
    const target = hash && document.getElementById(decodeURIComponent(hash.slice(1)));
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [content, hash]);

  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = title;
    return () => { document.title = previous; };
  }, [title]);

  return (
    <div className={`legal-page ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
