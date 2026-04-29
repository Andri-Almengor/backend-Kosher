function pickLocalized(lang, es, en, plain = "") {
  const esv = String(es ?? "").trim();
  const env = String(en ?? "").trim();
  const pv = String(plain ?? "").trim();
  if (lang === "en") return env || esv || pv;
  return esv || env || pv;
}

function toPublicProduct(item, lang = "es") {
  return {
    id: item.id,
    catGeneral: pickLocalized(lang, item.catGeneral, item.catGeneralEn),
    catGeneralEn: item.catGeneralEn,
    categoria1: pickLocalized(lang, item.categoria1, item.categoria1En),
    categoria1En: item.categoria1En,
    fabricanteMarca: pickLocalized(lang, item.fabricanteMarca, item.fabricanteMarcaEn),
    fabricanteMarcaEn: item.fabricanteMarcaEn,
    nombre: pickLocalized(lang, item.nombre, item.nombreEn),
    nombreEn: item.nombreEn,
    certifica: pickLocalized(lang, item.certifica, item.certificaEn),
    certificaEn: item.certificaEn,
    sello: pickLocalized(lang, item.sello, item.selloEn),
    selloEn: item.selloEn,
    atributo1: pickLocalized(lang, item.atributo1, item.atributo1En),
    atributo1En: item.atributo1En,
    atributo2: pickLocalized(lang, item.atributo2, item.atributo2En),
    atributo2En: item.atributo2En,
    atributo3: pickLocalized(lang, item.atributo3, item.atributo3En),
    atributo3En: item.atributo3En,
    tienda: pickLocalized(lang, item.tienda, item.tiendaEn),
    tiendaEn: item.tiendaEn,
    fotoProducto: item.fotoProducto,
    fotoSello1: item.fotoSello1,
    fotoSello2: item.fotoSello2,
    creadoEn: item.creadoEn,
    actualizadoEn: item.actualizadoEn,
  };
}

function toPublicRestaurant(item, lang = "es") {
  return {
    id: item.id,
    imageUrl: item.imageUrl,
    nombre: pickLocalized(lang, item.nombreEs, item.nombreEn, item.nombre),
    tipo: pickLocalized(lang, item.tipoEs, item.tipoEn, item.tipo),
    ubicacion: pickLocalized(lang, item.ubicacionEs, item.ubicacionEn, item.ubicacion),
    acercaDe: pickLocalized(lang, item.acercaDeEs, item.acercaDeEn, item.acercaDe),
    horario: pickLocalized(lang, item.horarioEs, item.horarioEn, item.horario),
    telefonoDescripcion: pickLocalized(lang, item.descripTelefonoEs, item.descripTelefonoEn),
    whatsappDescripcion: pickLocalized(lang, item.descripWhatsappEs, item.descripWhatsappEn),
    correoDescripcion: pickLocalized(lang, item.descripCorreoEs, item.descripCorreoEn),
    telefono: item.telefono || null,
    whatsapp: item.whatsapp || null,
    correo: item.correo || null,
    contacto: pickLocalized(lang, item.contactoEs, item.contactoEn, item.contacto),
    direccion: pickLocalized(lang, item.direccionEs, item.direccionEn, item.direccion),
    direccionLink: item.direccionLink,
    activo: item.activo,
    creadoEn: item.creadoEn,
    actualizadoEn: item.actualizadoEn,
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
}

function toPublicNews(item) {
  return {
    id: item.id,
    titulo: item.titulo,
    contenido: item.contenido,
    imageUrl: item.imageUrl,
    fileUrl: item.fileUrl,
    destino: item.destino,
    activo: item.activo,
    notifyUsers: item.notifyUsers,
    restauranteId: item.restauranteId,
    creadoEn: item.creadoEn,
    actualizadoEn: item.actualizadoEn,
    restaurante: item.restaurante
      ? {
          id: item.restaurante.id,
          nombre: item.restaurante.nombreEs,
          nombreEs: item.restaurante.nombreEs,
          nombreEn: item.restaurante.nombreEn,
          imageUrl: item.restaurante.imageUrl,
        }
      : null,
  };
}

function toPublicEvent(item) {
  return {
    id: item.id,
    titulo: item.titulo,
    descripcion: item.descripcion,
    ubicacion: item.ubicacion,
    inicio: item.inicio,
    fin: item.fin,
    todoElDia: item.todoElDia,
    creadoEn: item.creadoEn,
    actualizadoEn: item.actualizadoEn,
  };
}

module.exports = { pickLocalized, toPublicProduct, toPublicRestaurant, toPublicNews, toPublicEvent };
