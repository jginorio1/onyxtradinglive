// Datos estructurados (JSON-LD). Los buscadores los leen para mostrar
// resultados enriquecidos (estrellas, precio, preguntas desplegables).
export default function JsonLd({ data }: { data: any }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
