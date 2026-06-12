"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadata = void 0;
exports.default = RootLayout;
require("./globals.css");
exports.metadata = {
    title: 'Bulk Email Dispatcher Dashboard',
    description: 'High-performance bulk email job processing manager',
};
function RootLayout({ children, }) {
    return (<html lang="en">
      <body>
        {children}
      </body>
    </html>);
}
