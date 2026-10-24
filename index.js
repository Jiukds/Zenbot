const {
    Client,
    GatewayIntentBits,
    AttachmentBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ActivityType,
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require('discord.js');

const express = require('express');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// ========================================
// CONFIGURACIÓN DE IDS Y CANALES
// ========================================

const WELCOME_CHANNEL_ID = '1562990847501410323';
const STREAM_ALERT_CHANNEL_ID = '1562990847744540743';

const PORT = process.env.PORT || 3000;
const BG_PATH = path.join(__dirname, 'imagenes', 'bienvenida.png');
const STREAM_IMAGE_PATH = path.join(__dirname, 'imagenes', 'stream.png');

let cachedBackground = null;
let isCurrentlyLive = false;
let lastStreamId = null;

// ========================================
// CLIENTE DISCORD & SERVIDOR WEB
// ========================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

const app = express();
app.get('/', (_, res) => res.send('Bot de 1zennie activo ✅'));
app.listen(PORT, () => {
    console.log(`🌐 Servidor iniciado en el puerto ${PORT}`);
});

// ========================================
// TEXTO DE LAS REGLAS
// ========================================

const RULES_PART_1 = 
`# 🌸🎀 ・ REGLAS DEL SERVIDOR ・ 🎀🌸

> ✨ Para mantener una comunidad linda, segura y divertida, te pedimos respetar estas pequeñas reglas. Al quedarte, aceptás cumplirlas 🤍

### 🤍 1. Respeto
Tratá a todos con respeto. No se permite el acoso, las amenazas, la discriminación ni los ataques personales. Respetá al equipo de moderación, si tenés alguna queja, utilizá los canales correspondiente.

### 🎀 2. Spam y Flood
Evitá los mensajes repetidos, las cadenas, los emojis excesivos y las menciones masivas innecesarias.

### 🤍 3. Contenido Inapropiado
No se permite contenido pornográfico, sexual explícito, gore ni material inapropiado.

### 🦋 4. Publicidad
No promociones otros servidores, redes sociales o productos sin autorización del staff.

### 🤍 5. Nombres y Avatares
Usá perfiles apropiados. No suplantes la identidad de otros usuarios ni del staff.

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
### 👑 ・ SANCIONES ・ 👑

♡ **Nivel 1** — Advertencia formal
♡ **Nivel 2** — Silenciamiento temporal
♡ **Nivel 3** — Expulsión temporal
♡ **Nivel 4** — Baneo permanente

*Las sanciones dependerán de la gravedad de la infracción y de si existe reincidencia.*
▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`;

const RULES_PART_2 =
`### 🎀 6. Chat de Voz
Respetá a quienes estén en llamada. Evitá gritar, reproducir sonidos molestos o interrumpir intencionalmente.

### 🤍 7. Enlaces y Archivos
No compartas enlaces maliciosos, archivos sospechosos, estafas ni contenido dañino.

### 🦋 8. Privacidad
No difundas datos personales, conversaciones privadas ni imágenes ajenas sin consentimiento.

### 🤍 9. Trampas y Exploits
No utilices ni promociones hacks, exploits o métodos destinados a perjudicar a otros jugadores.

### 🎀 10. Evasión de Sanciones
No uses cuentas alternativas para evitar baneos, bloqueos o sanciones.

### 🤍 11. Uso de Canales
Utilizá cada canal para su propósito y respetá sus descripciones e indicaciones.

### 🦋 12. Convivencia
El staff podrá intervenir ante conductas perjudiciales para la comunidad, incluso si no están mencionadas expresamente en estas reglas.

*Gracias por formar parte de nuestra comunidad ♡*
> ˚₊‧꒰ა Respetá, disfrutá y hacé nuevos amigos ໒꒱ ‧₊˚`;

// ========================================
// FUNCIÓN: OBTENER DATOS DE TWITCH (1zennie)
// ========================================

async function fetchTwitchData() {
    const response = await fetch('https://gql.twitch.tv/gql', {
        method: 'POST',
        headers: {
            'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            query: `
                query {
                    user(login: "1zennie") {
                        displayName
                        profileImageURL(width: 300)
                        stream {
                            id
                            title
                            game {
                                name
                            }
                        }
                    }
                }
            `
        })
    });

    const json = await response.json();
    return json?.data?.user;
}

// ========================================
// FUNCIÓN: ARMAR ALERTA DE STREAM
// ========================================

function buildStreamAlertPayload(user, isTest = false) {
    const stream = user?.stream;
    const displayName = user?.displayName || '1zennie';
    const avatarUrl = user?.profileImageURL || 'https://static-cdn.jtvnw.net/jtv_user_pictures/xarth/404_user_70x70.png';
    const streamTitle = stream?.title || '¡Jugando y charlando un rato con el chat! 💜';
    const gameName = stream?.game?.name || 'Just Chatting';

    const embed = new EmbedBuilder()
        .setColor('#9146FF')
        .setAuthor({
            name: `${displayName} está en directo en Twitch!`,
            iconURL: avatarUrl,
            url: 'https://www.twitch.tv/1zennie'
        })
        .setTitle(streamTitle)
        .setURL('https://www.twitch.tv/1zennie')
        .addFields(
            { name: '🎮 Categoría', value: gameName, inline: true },
            { name: '🔴 Estado', value: stream ? 'En Vivo' : 'Prueba de Alerta', inline: true }
        )
        .setThumbnail(avatarUrl)
        .setFooter({ text: 'twitch.tv/1zennie' })
        .setTimestamp();

    const files = [];

    if (fs.existsSync(STREAM_IMAGE_PATH)) {
        const customImage = new AttachmentBuilder(STREAM_IMAGE_PATH, { name: 'stream.png' });
        files.push(customImage);
        embed.setImage('attachment://stream.png');
    } else {
        embed.setImage(`https://static-cdn.jtvnw.net/previews-ttv/live_user_1zennie-1280x720.jpg?t=${Date.now()}`);
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('🟣 Entrar al Stream')
            .setStyle(ButtonStyle.Link)
            .setURL('https://www.twitch.tv/1zennie')
    );

    const alertMessage = 'HOLAAAAAAAA PRENDÍ STREAM VENGAN A SALUDARME💖 <@&1562990847744540743>';

    const content = isTest
        ? `🧪 **[MODO PRUEBA]**\n${alertMessage}`
        : alertMessage;

    return { content, embeds: [embed], files, components: [row] };
}

// ========================================
// FUNCIÓN: REVISAR STREAM DE 1ZENNIE
// ========================================

async function checkTwitchStream() {
    try {
        const user = await fetchTwitchData();
        const stream = user?.stream;

        if (stream) {
            client.user.setActivity('🔴 EN VIVO • twitch.tv/1zennie', {
                type: ActivityType.Streaming,
                url: 'https://www.twitch.tv/1zennie'
            });

            if (!isCurrentlyLive && stream.id !== lastStreamId) {
                isCurrentlyLive = true;
                lastStreamId = stream.id;

                console.log('🟣 ¡1zennie prendió stream! Enviando alerta...');

                const alertChannel = await client.channels.fetch(STREAM_ALERT_CHANNEL_ID).catch(() => null);
                if (!alertChannel) {
                    console.log('⚠️ No se encontró el canal de alertas de stream.');
                    return;
                }

                const payload = buildStreamAlertPayload(user, false);
                await alertChannel.send(payload);
            }
        } else {
            isCurrentlyLive = false;
            client.user.setActivity('🔴 EN VIVO • twitch.tv/1zennie', {
                type: ActivityType.Streaming,
                url: 'https://www.twitch.tv/1zennie'
            });
        }
    } catch (error) {
        console.error('❌ Error comprobando Twitch:', error.message);
    }
}

// ========================================
// FUNCIÓN: CREAR TARJETA DE BIENVENIDA
// ========================================

async function createWelcomeCard(member) {
    const width = 736;
    const height = 414;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    if (!cachedBackground) {
        cachedBackground = await loadImage(BG_PATH);
    }

    const scale = Math.max(width / cachedBackground.width, height / cachedBackground.height);
    const bgWidth = cachedBackground.width * scale;
    const bgHeight = cachedBackground.height * scale;
    const bgX = (width - bgWidth) / 2;
    const bgY = (height - bgHeight) / 2;

    ctx.drawImage(cachedBackground, bgX, bgY, bgWidth, bgHeight);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, 0, width, height);

    const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
    const avatar = await loadImage(avatarURL);
    const avatarSize = 130;
    const avatarX = (width - avatarSize) / 2;
    const avatarY = 55;
    const centerX = avatarX + avatarSize / 2;
    const centerY = avatarY + avatarSize / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, avatarSize / 2 + 6, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, centerY, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    ctx.textAlign = 'center';

    ctx.font = 'bold 42px Arial';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'black';
    ctx.fillStyle = '#9f90be';
    ctx.strokeText('¡BIENVENIDO/A!', width / 2, 245);
    ctx.fillText('¡BIENVENIDO/A!', width / 2, 245);

    let username = member.user.displayName || member.user.username;
    if (username.length > 22) {
        username = username.substring(0, 22) + '...';
    }

    ctx.font = 'bold 32px Arial';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.strokeText(username, width / 2, 290);
    ctx.fillText(username, width / 2, 290);

    const memberCountText = `Miembro #${member.guild.memberCount}`;
    ctx.font = '22px Arial';
    ctx.strokeStyle = 'black';
    ctx.strokeText(memberCountText, width / 2, 330);
    ctx.fillText(memberCountText, width / 2, 330);

    return new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'bienvenida.png' });
}

// ========================================
// BOT LISTO
// ========================================

client.once('clientReady', async () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);

    try {
        cachedBackground = await loadImage(BG_PATH);
        console.log('🖼️ Imagen de bienvenida cargada correctamente.');
    } catch (err) {
        console.error('⚠️ No se encontró ./imagenes/bienvenida.png:', err.message);
    }

    if (fs.existsSync(STREAM_IMAGE_PATH)) {
        console.log('🖼️ Imagen personalizada de stream (./imagenes/stream.png) detectada.');
    }

    try {
        const commands = [
            new SlashCommandBuilder()
                .setName('testbienvenida')
                .setDescription('🧪 Probar cómo se ve la tarjeta de bienvenida')
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
            new SlashCommandBuilder()
                .setName('teststream')
                .setDescription('🧪 Probar cómo se ve la alerta de stream de 1zennie')
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
            new SlashCommandBuilder()
                .setName('reglas')
                .setDescription('📜 Publicar el reglamento del servidor')
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        ];

        await client.application.commands.set(commands);
        console.log('⚙️ Comandos registrados correctamente.');
    } catch (err) {
        console.error('❌ Error registrando comandos:', err.message);
    }

    await checkTwitchStream();
    setInterval(checkTwitchStream, 60 * 1000);
});

// ========================================
// NUEVO MIEMBRO (BIENVENIDA DIRECTA)
// ========================================

client.on('guildMemberAdd', async (member) => {
    try {
        const channel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
        if (!channel) {
            console.log('❌ No se encontró el canal de bienvenida.');
            return;
        }

        const attachment = await createWelcomeCard(member);

        const welcomeText =
            `👋 **¡Bienvenido/a ${member}!**\n\n` +
            `🎉 ¡Nos alegra tenerte en la comunidad de **1zennie**!\n` +
            `❤️ ¡Disfrutá del servidor!`;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('🟣 Ir al Twitch de 1zennie')
                .setStyle(ButtonStyle.Link)
                .setURL('https://www.twitch.tv/1zennie')
        );

        await channel.send({
            content: welcomeText,
            files: [attachment],
            components: [row]
        });

        await member.send({
            content: welcomeText,
            files: [attachment],
            components: [row]
        }).catch(() => {});

        console.log(`👋 Bienvenida enviada para ${member.user.tag}`);
    } catch (error) {
        console.error('❌ Error enviando bienvenida:', error);
    }
});

// ========================================
// COMANDOS DE INTERACCIÓN
// ========================================

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'testbienvenida') {
        await interaction.deferReply();
        try {
            const attachment = await createWelcomeCard(interaction.member);
            const welcomeText =
                `🧪 **[MODO PRUEBA]**\n` +
                `👋 **¡Bienvenido/a ${interaction.member}!**\n\n` +
                `🎉 ¡Nos alegra tenerte en la comunidad de **1zennie**!\n` +
                `❤️ ¡Disfrutá del servidor!`;

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('🟣 Ir al Twitch de 1zennie')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://www.twitch.tv/1zennie')
            );

            await interaction.editReply({
                content: welcomeText,
                files: [attachment],
                components: [row]
            });
        } catch (error) {
            console.error('❌ Error en /testbienvenida:', error);
            await interaction.editReply('❌ Hubo un error al generar la tarjeta de bienvenida.');
        }
    }

    if (interaction.commandName === 'teststream') {
        await interaction.deferReply();
        try {
            const user = await fetchTwitchData();
            const payload = buildStreamAlertPayload(user, true);
            await interaction.editReply(payload);
        } catch (error) {
            console.error('❌ Error en /teststream:', error);
            await interaction.editReply({
                content: '❌ Hubo un error al obtener los datos de Twitch.',
                flags: MessageFlags.Ephemeral
            });
        }
    }

    if (interaction.commandName === 'reglas') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ Solo los administradores pueden usar este comando.',
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            await interaction.channel.send(RULES_PART_1);
            await interaction.channel.send(RULES_PART_2);

            await interaction.editReply({
                content: '✅ ¡Las reglas han sido publicadas correctamente en este canal!'
            });
        } catch (error) {
            console.error('❌ Error al publicar las reglas:', error);
            await interaction.editReply({
                content: '❌ Hubo un error al intentar enviar el mensaje de reglas.'
            });
        }
    }
});

// ========================================
// LOGIN
// ========================================

client.login(process.env.TOKEN);