import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { replaceVariables } from "@/lib/variableReplacer";
import { PopupFormModal } from "@/components/sites/PopupFormModal";
import { useIsMobile } from "@/hooks/use-mobile";

interface BlockAdvanced {
  hideOnMobile?: boolean;
  hideOnDesktop?: boolean;
  buttonAction?: string;
  buttonUrl?: string;
  scrollTarget?: string;
}

interface PageBlock {
  id: string;
  type: string;
  content: Record<string, string>;
  advanced?: BlockAdvanced;
}

interface PageSection {
  id: string;
  name?: string;
  rows: any[];
  width: string;
  backgroundColor?: string;
  paddingTop?: string;
  paddingBottom?: string;
  visibility?: { hideOnMobile?: boolean; hideOnDesktop?: boolean };
}

export default function PublicLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [showPopup, setShowPopup] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("landing_pages")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .single();

      if (data) {
        setPage(data);
        // Increment views
        await supabase.from("landing_pages").update({ views_count: (data.views_count || 0) + 1 }).eq("id", data.id);

        // Load dynamic variables
        const { data: vars } = await supabase
          .from("dynamic_variables")
          .select("key, value")
          .eq("user_id", data.user_id);

        const varMap: Record<string, string> = {};
        vars?.forEach((v) => { varMap[v.key] = v.value; });
        varMap["date"] = new Date().toLocaleDateString();
        varMap["year"] = new Date().getFullYear().toString();
        setVariables(varMap);
      }
      setLoading(false);
    }
    if (slug) load();
  }, [slug]);

  const rv = (text: string) => replaceVariables(text, variables);

  const shouldHide = (visibility?: { hideOnMobile?: boolean; hideOnDesktop?: boolean }) => {
    if (!visibility) return false;
    if (isMobile && visibility.hideOnMobile) return true;
    if (!isMobile && visibility.hideOnDesktop) return true;
    return false;
  };

  const handleButtonClick = (advanced?: BlockAdvanced) => {
    if (!advanced?.buttonAction || advanced.buttonAction === "popup_form") {
      setShowPopup(true);
    } else if (advanced.buttonAction === "external_link" && advanced.buttonUrl) {
      window.open(advanced.buttonUrl, "_blank");
    } else if (advanced.buttonAction === "scroll_to" && advanced.scrollTarget) {
      document.getElementById(advanced.scrollTarget)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (!page) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Page not found</div>;

  const content = Array.isArray(page.content) ? page.content : [];
  const isNested = content.length > 0 && content[0]?.rows;

  // Render flat blocks (PageBlock[])
  const renderBlock = (block: PageBlock) => {
    if (shouldHide(block.advanced)) return null;

    switch (block.type) {
      case "hero":
        return (
          <section key={block.id} className="py-16 md:py-24 px-6 text-center bg-gradient-to-br from-primary/5 to-primary/10">
            <h1 className="text-3xl md:text-5xl font-bold mb-4">{rv(block.content.headline)}</h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">{rv(block.content.subheadline)}</p>
            <button onClick={() => handleButtonClick(block.advanced)} className="px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition">
              {rv(block.content.buttonText)}
            </button>
          </section>
        );
      case "cta":
        return (
          <section key={block.id} className="py-16 px-6 text-center bg-primary/5">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">{rv(block.content.headline)}</h2>
            <p className="text-muted-foreground mb-6">{rv(block.content.subheadline)}</p>
            <button onClick={() => handleButtonClick(block.advanced)} className="px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition">
              {rv(block.content.buttonText)}
            </button>
          </section>
        );
      case "features":
        return (
          <section key={block.id} className="py-12 px-6">
            <h2 className="text-2xl font-bold text-center mb-8">{rv(block.content.title)}</h2>
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {[1, 2, 3].map((n) => (
                <div key={n} className="p-6 rounded-lg border bg-card">
                  <h3 className="font-semibold mb-2">{rv(block.content[`feature${n}`])}</h3>
                  <p className="text-sm text-muted-foreground">{rv(block.content[`desc${n}`])}</p>
                </div>
              ))}
            </div>
          </section>
        );
      case "testimonials":
        return (
          <section key={block.id} className="py-12 px-6 bg-secondary/30">
            <h2 className="text-2xl font-bold text-center mb-8">{rv(block.content.title)}</h2>
            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {[1, 2].map((n) => (
                <div key={n} className="p-6 rounded-lg border bg-card">
                  <p className="italic text-muted-foreground mb-3">"{rv(block.content[`quote${n}`])}"</p>
                  <p className="font-medium text-sm">— {rv(block.content[`name${n}`])}</p>
                </div>
              ))}
            </div>
          </section>
        );
      case "text":
        return (
          <section key={block.id} className="py-10 px-6 max-w-3xl mx-auto">
            <h2 className="text-xl font-bold mb-3">{rv(block.content.heading)}</h2>
            <p className="text-muted-foreground whitespace-pre-wrap">{rv(block.content.body)}</p>
          </section>
        );
      case "image":
        return (
          <section key={block.id} className="py-10 px-6 max-w-4xl mx-auto">
            <h2 className="text-xl font-bold mb-3">{rv(block.content.heading)}</h2>
            <p className="text-muted-foreground mb-4">{rv(block.content.body)}</p>
            {block.content.imageUrl && <img src={block.content.imageUrl} alt={block.content.heading} className="rounded-lg w-full" />}
          </section>
        );
      default:
        return null;
    }
  };

  // Render nested sections (PageSection[])
  const renderSection = (section: PageSection) => {
    if (shouldHide(section.visibility)) return null;
    
    const widthClass = section.width === "narrow" ? "max-w-3xl mx-auto" : section.width === "container" ? "max-w-6xl mx-auto" : "";
    
    return (
      <section
        key={section.id}
        id={section.name?.toLowerCase().replace(/\s+/g, "-")}
        style={{
          backgroundColor: section.backgroundColor || undefined,
          paddingTop: section.paddingTop ? `${section.paddingTop}px` : undefined,
          paddingBottom: section.paddingBottom ? `${section.paddingBottom}px` : undefined,
        }}
      >
        <div className={`px-6 ${widthClass}`}>
          {section.rows?.map((row) => (
            <div key={row.id} className="flex flex-wrap gap-6" style={{ alignItems: row.verticalAlign || "top" }}>
              {row.columns?.map((col: any) => (
                <div key={col.id} className="flex-1 min-w-[250px]" style={{ padding: col.padding ? `${col.padding}px` : undefined }}>
                  {col.elements?.map((el: any) => {
                    if (shouldHide(el.visibility)) return null;
                    return renderElement(el);
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    );
  };

  const renderElement = (el: any) => {
    switch (el.type) {
      case "heading":
        const Tag = (el.content.level || "h2") as keyof JSX.IntrinsicElements;
        return <Tag key={el.id} className="font-bold mb-3 text-2xl">{rv(el.content.text)}</Tag>;
      case "text":
        return <p key={el.id} className="text-muted-foreground mb-4 whitespace-pre-wrap">{rv(el.content.content)}</p>;
      case "image":
        return el.content.src ? <img key={el.id} src={el.content.src} alt={rv(el.content.alt)} className="rounded-lg w-full mb-4" /> : null;
      case "button":
        return (
          <button key={el.id} onClick={() => handleButtonClick(el.buttonAction)} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium mb-4 hover:opacity-90 transition">
            {rv(el.content.text)}
          </button>
        );
      case "video":
        return el.content.url ? (
          <div key={el.id} className="mb-4 aspect-video">
            <iframe src={el.content.url} className="w-full h-full rounded-lg" allowFullScreen />
          </div>
        ) : null;
      case "divider":
        return <hr key={el.id} className="my-6 border-border" />;
      case "spacer":
        return <div key={el.id} style={{ height: `${el.content.height || 40}px` }} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {page.custom_css && <style>{page.custom_css}</style>}
      {isNested
        ? content.map((section: any) => renderSection(section))
        : content.map((block: any) => renderBlock(block))
      }
      <PopupFormModal
        open={showPopup}
        onClose={() => setShowPopup(false)}
        pageId={page.id}
        userId={page.user_id}
      />
    </div>
  );
}
