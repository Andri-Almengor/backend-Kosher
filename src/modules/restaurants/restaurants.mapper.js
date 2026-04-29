
function pick(lang, es, en) {
  if (lang === "en") return en || es || "";
  return es || en || "";
}

exports.toPublicRestaurant = (item, lang = "es") => {
  if (!item) return null;

  return {
    id: item.id,
    nombre: pick(lang, item.nombreEs, item.nombreEn),
    tipo: pick(lang, item.tipoEs, item.tipoEn),
    ubicacion: pick(lang, item.ubicacionEs, item.ubicacionEn),
    acercaDe: pick(lang, item.acercaDeEs, item.acercaDeEn),
    horario: pick(lang, item.horarioEs, item.horarioEn),
    telefonoDescripcion: pick(lang, item.descripTelefonoEs, item.descripTelefonoEn),
    whatsappDescripcion: pick(lang, item.descripWhatsappEs, item.descripWhatsappEn),
    correoDescripcion: pick(lang, item.descripCorreoEs, item.descripCorreoEn),
    telefono: item.telefono || null,
    whatsapp: item.whatsapp || null,
    correo: item.correo || null,
    contacto: pick(lang, item.contactoEs, item.contactoEn),
    direccion: pick(lang, item.direccionEs, item.direccionEn),
    direccionLink: item.direccionLink,

    nombreEs: item.nombreEs,
    nombreEn: item.nombreEn,
    tipoEs: item.tipoEs,
    tipoEn: item.tipoEn,
    ubicacionEs: item.ubicacionEs,
    ubicacionEn: item.ubicacionEn,
    acercaDeEs: item.acercaDeEs,
    acercaDeEn: item.acercaDeEn,
    horarioEs: item.horarioEs,
    horarioEn: item.horarioEn,
    telefonoRaw: item.telefono || null,
    descripTelefonoEs: item.descripTelefonoEs,
    descripTelefonoEn: item.descripTelefonoEn,
    whatsappRaw: item.whatsapp || null,
    descripWhatsappEs: item.descripWhatsappEs,
    descripWhatsappEn: item.descripWhatsappEn,
    correoRaw: item.correo || null,
    descripCorreoEs: item.descripCorreoEs,
    descripCorreoEn: item.descripCorreoEn,
    contactoEs: item.contactoEs,
    contactoEn: item.contactoEn,
    direccionEs: item.direccionEs,
    direccionEn: item.direccionEn,
  };
};
