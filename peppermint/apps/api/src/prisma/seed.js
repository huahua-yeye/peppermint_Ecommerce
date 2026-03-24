const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const prisma = new PrismaClient();

/** 纯数字密码（仅 0–9）；入库前 bcrypt 哈希。登录：admin@admin.com / agent*@ecommerce.demo 均为此密码 */
const SEED_LOGIN_PASSWORD = "1234";

async function main() {
  /** 由 SEED_LOGIN_PASSWORD 算出；User.password 列只存哈希，不能直接写明文 */
  const seedPasswordBcrypt = await bcrypt.hash(SEED_LOGIN_PASSWORD, 10);

  const setup = await prisma.config.findFirst({});
  const templates = await prisma.emailTemplate.findMany({});

  if (setup === null) {
    await prisma.user.upsert({
      where: { email: "admin@admin.com" },
      update: {},
      create: {
        email: `admin@admin.com`,
        name: "admin",
        isAdmin: true,
        password: seedPasswordBcrypt,
        language: "en",
      },
    });

    await prisma.client.upsert({
      where: { email: `internal@admin.com` },
      update: {},
      create: {
        email: `internal@admin.com`,
        name: "internal",
        contactName: "admin",
        number: "123456789",
        active: true,
      },
    });

    const encryptionKey = crypto.randomBytes(32); // Generates a random key

    const conf = await prisma.config.create({
      data: {
        gh_version: "0.4.3",
        client_version: "0.4.3",
        encryption_key: encryptionKey,
      },
    });

    await prisma.config.update({
      where: {
        id: conf.id,
      },
      data: {
        first_time_setup: false,
      },
    });
  } else {
    console.log("No need to seed, already seeded");
  }

  // E-commerce demo data (only when demo client does not exist)
  const demoClient = await prisma.client.findUnique({
    where: { email: "demo.ecommerce@seed.local" },
  });
  const adminUser = await prisma.user.findFirst({ where: { isAdmin: true } });

  if (!demoClient && adminUser) {
    console.log("Seeding e-commerce demo data...");
    {
      // 1. Agent users
      const agent1 = await prisma.user.upsert({
        where: { email: "agent1@ecommerce.demo" },
        update: {},
        create: {
          email: "agent1@ecommerce.demo",
          name: "Agent Alex",
          password: seedPasswordBcrypt,
          language: "en",
          isAdmin: false,
        },
      });
      const agent2 = await prisma.user.upsert({
        where: { email: "agent2@ecommerce.demo" },
        update: {},
        create: {
          email: "agent2@ecommerce.demo",
          name: "Agent Sam",
          password: seedPasswordBcrypt,
          language: "en",
          isAdmin: false,
        },
      });

      // 2. Clients
      const clients = await Promise.all([
        prisma.client.upsert({
          where: { email: "zhangsan@example.com" },
          update: {},
          create: {
            name: "John Smith",
            email: "zhangsan@example.com",
            contactName: "John Smith",
            number: "+1-555-0101",
            shippingAddress: "88 Main St, New York, NY 10001",
            notes: "VIP customer",
            active: true,
          },
        }),
        prisma.client.upsert({
          where: { email: "lisi@example.com" },
          update: {},
          create: {
            name: "Jane Doe",
            email: "lisi@example.com",
            contactName: "Jane Doe",
            number: "+1-555-0102",
            shippingAddress: "1000 Commerce Blvd, Los Angeles, CA 90001",
            active: true,
          },
        }),
        prisma.client.upsert({
          where: { email: "wangwu@example.com" },
          update: {},
          create: {
            name: "Bob Wilson",
            email: "wangwu@example.com",
            contactName: "Bob Wilson",
            number: "+1-555-0103",
            shippingAddress: "123 Market St, Houston, TX 77001",
            active: true,
          },
        }),
        prisma.client.upsert({
          where: { email: "zhaoliu@example.com" },
          update: {},
          create: {
            name: "Alice Brown",
            email: "zhaoliu@example.com",
            contactName: "Alice Brown",
            number: "+1-555-0104",
            shippingAddress: "1 Tech Park Dr, San Jose, CA 95101",
            active: true,
          },
        }),
        prisma.client.upsert({
          where: { email: "demo.ecommerce@seed.local" },
          update: {},
          create: {
            name: "Demo E-Commerce Customer",
            email: "demo.ecommerce@seed.local",
            contactName: "Demo",
            number: "+1-555-0000",
            shippingAddress: "456 Demo Ave, Seattle, WA 98101",
            notes: "Seed demo account",
            active: true,
          },
        }),
      ]);

      // 3. Team
      const team = await prisma.team.upsert({
        where: { id: "ecom-team-seed-id" },
        update: {},
        create: {
          id: "ecom-team-seed-id",
          name: "E-Commerce Support",
        },
      });

      // 4. Orders
      const orders = await Promise.all([
        prisma.order.create({ data: { orderNumber: "ORD202401001", totalAmount: 299.0, status: "delivered", clientId: clients[0].id, items: [{ sku: "SKU001", name: "Wireless earbuds", qty: 1, price: 299 }] } }),
        prisma.order.create({ data: { orderNumber: "ORD202401002", totalAmount: 1588.0, status: "shipped", clientId: clients[0].id, items: [{ sku: "SKU002", name: "Laptop stand", qty: 2, price: 794 }] } }),
        prisma.order.create({ data: { orderNumber: "ORD202401003", totalAmount: 89.9, status: "paid", clientId: clients[1].id, items: [{ sku: "SKU003", name: "Phone case", qty: 3, price: 29.97 }] } }),
        prisma.order.create({ data: { orderNumber: "ORD202401004", totalAmount: 2560.0, status: "refunded", clientId: clients[2].id, items: [{ sku: "SKU004", name: "Mechanical keyboard", qty: 1, price: 2560 }] } }),
        prisma.order.create({ data: { orderNumber: "ORD202401005", totalAmount: 599.0, status: "pending", clientId: clients[3].id, items: [{ sku: "SKU005", name: "Bluetooth speaker", qty: 1, price: 599 }] } }),
      ]);

      const createdBy = { id: adminUser.id, name: adminUser.name, role: "admin", email: adminUser.email };

      // 5. Tickets (20+ covering types and statuses)
      const ticketData = [
        { title: "ORD202401001 delivered but item has scratches", type: "refund", status: "needs_support", priority: "High", clientId: clients[0].id, orderId: orders[0].id, isComplete: false, assignedToId: agent1.id },
        { title: "Tracking has not updated for 3 days", type: "shipping", status: "in_progress", priority: "High", clientId: clients[0].id, orderId: orders[1].id, isComplete: false, assignedToId: agent1.id },
        { title: "What is the battery life of these earbuds?", type: "product_inquiry", status: "done", priority: "Normal", clientId: clients[0].id, isComplete: true, assignedToId: agent2.id },
        { title: "Wrong shipping address on ORD202401003 — need to change", type: "order_issue", status: "in_progress", priority: "Normal", clientId: clients[1].id, orderId: orders[2].id, isComplete: false, assignedToId: agent2.id },
        { title: "Wrong size — want to exchange for another size", type: "return_exchange", status: "needs_support", priority: "Normal", clientId: clients[1].id, isComplete: false },
        { title: "WeChat Pay charged but order shows unpaid", type: "payment", status: "in_progress", priority: "High", clientId: clients[2].id, orderId: orders[3].id, isComplete: false, assignedToId: agent1.id },
        { title: "Refund request pending for one week", type: "refund", status: "in_review", priority: "High", clientId: clients[2].id, orderId: orders[3].id, isComplete: false, assignedToId: agent1.id },
        { title: "Cannot reach courier — where was the package left?", type: "shipping", status: "hold", priority: "Normal", clientId: clients[2].id, isComplete: false, assignedToId: agent2.id },
        { title: "Is this keyboard available in white?", type: "product_inquiry", status: "done", priority: "Low", clientId: clients[2].id, isComplete: true, assignedToId: agent2.id },
        { title: "Want to add one more item to ORD202401005", type: "order_issue", status: "needs_support", priority: "Normal", clientId: clients[3].id, orderId: orders[4].id, isComplete: false },
        { title: "Item does not match listing — request return", type: "return_exchange", status: "in_progress", priority: "High", clientId: clients[3].id, isComplete: false, assignedToId: agent1.id },
        { title: "Charged twice via Alipay", type: "payment", status: "needs_support", priority: "High", clientId: clients[0].id, isComplete: false, assignedToId: agent2.id },
        { title: "General: how do loyalty points work?", type: "support", status: "done", priority: "Low", clientId: clients[1].id, isComplete: true, assignedToId: agent2.id },
        { title: "Marked delivered but I did not receive the package", type: "shipping", status: "needs_support", priority: "High", clientId: clients[1].id, isComplete: false },
        { title: "When will this product be back in stock?", type: "product_inquiry", status: "in_progress", priority: "Normal", clientId: clients[3].id, isComplete: false, assignedToId: agent1.id },
        { title: "How long until refund after order cancellation?", type: "refund", status: "done", priority: "Normal", clientId: clients[4].id, isComplete: true, assignedToId: agent2.id },
        { title: "Can I fix a wrong note on my order?", type: "order_issue", status: "done", priority: "Low", clientId: clients[4].id, isComplete: true, assignedToId: agent1.id },
        { title: "How does the exchange process work?", type: "return_exchange", status: "needs_support", priority: "Normal", clientId: clients[4].id, isComplete: false },
        { title: "Credit card payment failed with an error", type: "payment", status: "in_review", priority: "High", clientId: clients[4].id, isComplete: false, assignedToId: agent1.id },
        { title: "Any recommendation for earbuds in the same price range?", type: "product_inquiry", status: "hold", priority: "Low", clientId: clients[0].id, isComplete: false, assignedToId: agent2.id },
        { title: "Follow-up: order still not shipped", type: "shipping", status: "in_progress", priority: "Normal", clientId: clients[3].id, orderId: orders[4].id, isComplete: false, assignedToId: agent1.id },
        { title: "Promo code not applying at checkout", type: "support", status: "needs_support", priority: "Normal", clientId: clients[2].id, isComplete: false },
      ];

      for (const t of ticketData) {
        const { assignedToId, clientId, orderId, ...rest } = t;
        await prisma.ticket.create({
          data: {
            ...rest,
            fromImap: false,
            detail: JSON.stringify({ content: "Customer inquiry details" }),
            assignedTo: assignedToId ? { connect: { id: assignedToId } } : undefined,
            client: clientId ? { connect: { id: clientId } } : undefined,
            order: orderId ? { connect: { id: orderId } } : undefined,
            team: { connect: { id: team.id } },
            createdBy,
          },
        });
      }

      // 6. Comments on recent tickets
      const tickets = await prisma.ticket.findMany({ take: 5, orderBy: { createdAt: "desc" } });
      for (let i = 0; i < Math.min(3, tickets.length); i++) {
        await prisma.comment.create({
          data: {
            ticketId: tickets[i].id,
            text: i === 0 ? "Contacted carrier — will reply today." : i === 1 ? "Exchange arranged. New tracking: SF1234567890" : "Refund issued to original payment method; 3–5 business days.",
            public: true,
            userId: i % 2 === 0 ? agent1.id : agent2.id,
          },
        });
      }

      // 7. Knowledge base
      await prisma.knowledgeBase.createMany({
        data: [
          { title: "Refund policy", content: "30-day returns for unused items. Refunds in 3–5 business days.", tags: ["refund", "returns"], author: "Agent Alex", public: true },
          { title: "Shipping times", content: "Most regions 2–3 days; remote areas 5–7. Contact support for expedited shipping.", tags: ["shipping", "delivery"], author: "Agent Sam", public: true },
          { title: "Returns and exchanges", content: "1. Submit request 2. Ship item back 3. Warehouse inspection 4. Replacement or refund", tags: ["returns"], author: "Agent Alex", public: true },
          { title: "Payment methods", content: "We accept card, PayPal, and major wallets. If payment fails, contact support.", tags: ["payment"], author: "Agent Sam", public: true },
        ],
      });

      // 8. Notifications
      await prisma.notifications.createMany({
        data: [
          { userId: adminUser.id, text: "New ticket: ORD202401001 delivered but item has scratches", read: false, ticketId: tickets[0]?.id },
          { userId: agent1.id, text: "You were assigned: Tracking has not updated for 3 days", read: true, ticketId: tickets[1]?.id },
        ],
      });

      console.log(`E-commerce demo seeded: ${clients.length} clients, ${orders.length} orders, ${ticketData.length} tickets`);
    }
  }

  if (templates.length === 0) {
    await prisma.emailTemplate.createMany({
      data: [
        {
          html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
          <html lang="en">
            <head>
              <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
            </head>
            <div id="" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Ticket Created<div></div>
            </div>
  
            <body style="background-color:#ffffff;margin:0 auto;font-family:-apple-system, BlinkMacSystemFont, &#x27;Segoe UI&#x27;, &#x27;Roboto&#x27;, &#x27;Oxygen&#x27;, &#x27;Ubuntu&#x27;, &#x27;Cantarell&#x27;, &#x27;Fira Sans&#x27;, &#x27;Droid Sans&#x27;, &#x27;Helvetica Neue&#x27;, sans-serif">
              <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto">
                <tr style="width:100%">
                  <td>
                    <table style="margin-top:8px" align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%">
                    </table>
                    <h1 style="color:#1d1c1d;font-size:16px;font-weight:700;margin:10px 0;padding:0;line-height:42px">Ticket Assigned</h1>
                    <p style="font-size:20px;line-height:28px;margin:4px 0">
                    <p>Hello, <br>A new ticket has been assigned to you.</p>
                    <p style="font-size:14px;margin:16px 0;color:#000">
                    Kind regards, 
  
                    <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%">
                      <tbody>
                        <tr>
                          <td>
                            <a target="_blank" style="color:#b7b7b7;text-decoration:underline" href="https://docs.peppermint.sh" rel="noopener noreferrer">Documentation</a>   |   <a target="_blank" style="color:#b7b7b7;text-decoration:underline" href="https://discord.gg/8XFkbgKmgv" rel="noopener noreferrer">Discord</a> </a>
                            <p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left">This was an automated message sent by peppermint.sh -> An open source helpdesk solution</p>
                            <p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left;margin-bottom:50px">©2022 Peppermint Ticket Management, a Peppermint Labs product.<br />All rights reserved.</p>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          </html>`,
          type: "ticket_assigned",
        },
        {
          html: ` <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
          <html lang="en">

            <head>
              <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
            </head>
            <div id="" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Ticket Created<div></div>
            </div>

            <body style="background-color:#ffffff;margin:0 auto;font-family:-apple-system, BlinkMacSystemFont, &#x27;Segoe UI&#x27;, &#x27;Roboto&#x27;, &#x27;Oxygen&#x27;, &#x27;Ubuntu&#x27;, &#x27;Cantarell&#x27;, &#x27;Fira Sans&#x27;, &#x27;Droid Sans&#x27;, &#x27;Helvetica Neue&#x27;, sans-serif">
              <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto">
                <tr style="width:100%">
                  <td>
                    <table style="margin-top:8px" align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%">
                    </table>
                    <h1 style="color:#1d1c1d;font-size:16px;font-weight:700;margin:10px 0;padding:0;line-height:42px">Ticket Update for: {{title}}</h1>
                    <p style="font-size:20px;line-height:28px;margin:4px 0">
                    <p>{{comment}}</p>
                    <p style="font-size:14px;margin:16px 0;color:#000">
                    Kind regards, 

                    <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%">
                      <tbody>
                        <tr>
                          <td>
                          <a target="_blank" style="color:#b7b7b7;text-decoration:underline" href="https://docs.peppermint.sh" rel="noopener noreferrer">Documentation</a>   |   <a target="_blank" style="color:#b7b7b7;text-decoration:underline" href="https://discord.gg/8XFkbgKmgv" rel="noopener noreferrer">Discord</a> </a>
                          <p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left">This was an automated message sent by peppermint.sh -> An open source helpdesk solution</p>
                            <p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left;margin-bottom:50px">©2022 Peppermint Ticket Management, a Peppermint Labs product.<br />All rights reserved.</p>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          </html>`,
          type: "ticket_comment",
        },
        {
          html: ` <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
          <html lang="en">

            <head>
              <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
            </head>
            <div id="" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Ticket Created<div></div>
            </div>

            <body style="background-color:#ffffff;margin:0 auto;font-family:-apple-system, BlinkMacSystemFont, &#x27;Segoe UI&#x27;, &#x27;Roboto&#x27;, &#x27;Oxygen&#x27;, &#x27;Ubuntu&#x27;, &#x27;Cantarell&#x27;, &#x27;Fira Sans&#x27;, &#x27;Droid Sans&#x27;, &#x27;Helvetica Neue&#x27;, sans-serif">
              <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto">
                <tr style="width:100%">
                  <td>
                    <table style="margin-top:8px" align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%">
                    </table>
                    <h1 style="color:#1d1c1d;font-size:16px;font-weight:700;margin:10px 0;padding:0;line-height:42px">Ticket Created: {{id}}</h1>
                    <p style="font-size:20px;line-height:28px;margin:4px 0">
                    <p>Hello, <br>Your ticket has now been created and logged.</p>
                    <p style="font-size:14px;margin:16px 0;color:#000">
                    Kind regards, 

                    <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%">
                      <tbody>
                        <tr>
                          <td>
                          <a target="_blank" style="color:#b7b7b7;text-decoration:underline" href="https://docs.peppermint.sh" rel="noopener noreferrer">Documentation</a>   |   <a target="_blank" style="color:#b7b7b7;text-decoration:underline" href="https://discord.gg/8XFkbgKmgv" rel="noopener noreferrer">Discord</a> </a>
                          <p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left">This was an automated message sent by peppermint.sh -> An open source helpdesk solution</p>
                            <p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left;margin-bottom:50px">©2022 Peppermint Ticket Management, a Peppermint Labs product.<br />All rights reserved.</p>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </table>
            </body>

          </html>`,
          type: "ticket_created",
        },
        {
          html: ` <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
          <html lang="en">
          
            <head>
              <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
            </head>
            <div id="" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Ticket Created<div></div>
            </div>
          
            <body style="background-color:#ffffff;margin:0 auto;font-family:-apple-system, BlinkMacSystemFont, &#x27;Segoe UI&#x27;, &#x27;Roboto&#x27;, &#x27;Oxygen&#x27;, &#x27;Ubuntu&#x27;, &#x27;Cantarell&#x27;, &#x27;Fira Sans&#x27;, &#x27;Droid Sans&#x27;, &#x27;Helvetica Neue&#x27;, sans-serif">
              <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto">
                <tr style="width:100%">
                  <td>
                    <table style="margin-top:8px" align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%">
                      <tbody>
                        <tr>
                          <td><img alt="Slack" src="https://raw.githubusercontent.com/Peppermint-Lab/peppermint/next/static/black-side-logo.svg" width="200" height="60" style="display:block;outline:none;border:none;text-decoration:none" /></td>
                        </tr>
                      </tbody>
                    </table>
                    <h1 style="color:#1d1c1d;font-size:16px;font-weight:700;margin:10px 0;padding:0;line-height:42px">Ticket: {{title}}</h1>
                    <p style="font-size:20px;line-height:28px;margin:4px 0">
                    <p>Your Ticket, now has a status of {{status}}</p>
                    Kind regards, 
                    <br>
                    Peppermint ticket management
                    </p>
                    
                    <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%">
                      <tbody>
                        <tr>
                          <td>
                          <a target="_blank" style="color:#b7b7b7;text-decoration:underline" href="https://docs.peppermint.sh" rel="noopener noreferrer">Documentation</a>   |   <a target="_blank" style="color:#b7b7b7;text-decoration:underline" href="https://discord.gg/8XFkbgKmgv" rel="noopener noreferrer">Discord</a> </a>
                          <p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left">This was an automated message sent by peppermint.sh -> An open source helpdesk solution</p>
                            <p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left;margin-bottom:50px">©2022 Peppermint Ticket Management, a Peppermint Labs product.<br />All rights reserved.</p>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          
          </html>`,
          type: "ticket_status_changed",
        },
      ],
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
